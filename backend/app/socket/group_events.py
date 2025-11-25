"""
Real-time socket events for group actions:
 - create group
 - add member
 - remove member
 - broadcast announcements
"""

from app import socketio
from flask_socketio import join_room
from app.database import get_db
from bson import ObjectId
from datetime import datetime
import traceback


# =====================================================
#  GROUP CREATE
# =====================================================

@socketio.on("group:create")
def on_group_create(data):
    """
    data = {
        title: str,
        members: [user_id...],
        created_by: str,
        description?: str
    }
    """
    try:
        db = get_db()

        title = data.get("title")
        members = data.get("members", [])
        created_by = data.get("created_by")
        description = data.get("description")

        if not title or not members or not created_by:
            return

        # ----------------------
        # 1. Create Group
        # ----------------------
        group_doc = {
            "title": title,
            "description": description,
            "created_by": created_by,
            "members": members,
            "admin_ids": [created_by],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "settings": {
                "allow_media": True,
                "allow_polls": True,
                "allow_reactions": True,
            }
        }

        res = db.groups.insert_one(group_doc)
        group_id = str(res.inserted_id)
        group_doc["_id"] = group_id

        # ----------------------
        # 2. Create Chat Mirror
        # ----------------------
        chat_doc = {
            "chat_type": "group",
            "participants": members,
            "title": title,
            "description": description,
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_message_at": None,
            "group_settings": group_doc["settings"],
            "group_id": group_id     # 🔥 IMPORTANT: Link chat <-> group
        }

        chat_res = db.chats.insert_one(chat_doc)
        chat_id = str(chat_res.inserted_id)

        # Update group with chat reference
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"chat_id": chat_id}}
        )

        # ----------------------
        # 3. Send invite event to each user
        # ----------------------
        for uid in members:
            socketio.emit(
                "group:invited",
                {"group": group_doc, "chat_id": chat_id},
                room=f"user:{uid}"
            )

        # ----------------------
        # 4. Broadcast group created
        # ----------------------
        socketio.emit(
            "group:created",
            {"group": group_doc, "chat_id": chat_id}
        )

    except Exception:
        print("[group:create] error:", traceback.format_exc())



# =====================================================
#  ADD MEMBER
# =====================================================

@socketio.on("group:add_member")
def on_group_add_member(data):
    """
    data = { group_id: str, member_id: str, added_by: str }
    """
    try:
        db = get_db()

        group_id = data.get("group_id")
        member_id = data.get("member_id")
        added_by = data.get("added_by")

        if not group_id or not member_id or not added_by:
            return

        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            return

        # Admin check
        if added_by not in group.get("admin_ids", []):
            return

        # Update group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$addToSet": {"members": member_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        chat_id = group.get("chat_id")
        if chat_id:
            # Update chat participants mirror
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {
                    "$addToSet": {"participants": member_id},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )

            # Auto join socket room
            join_room(f"chat:{chat_id}")

        # Notify new member
        socketio.emit(
            "group:member_added",
            {
                "group_id": group_id,
                "member_id": member_id,
                "chat_id": chat_id
            },
            room=f"user:{member_id}"
        )

        # Notify existing members
        if chat_id:
            socketio.emit(
                "group:member_joined",
                {
                    "group_id": group_id,
                    "member_id": member_id
                },
                room=f"chat:{chat_id}"
            )

    except Exception:
        print("[group:add_member] error:", traceback.format_exc())



# =====================================================
#  REMOVE MEMBER
# =====================================================

@socketio.on("group:remove_member")
def on_group_remove_member(data):
    """
    data = { group_id: str, member_id: str, removed_by: str }
    """
    try:
        db = get_db()

        group_id = data.get("group_id")
        member_id = data.get("member_id")
        removed_by = data.get("removed_by")

        if not group_id or not member_id or not removed_by:
            return

        group = db.groups.find_one({"_id": ObjectId(group_id)})
        if not group:
            return

        # Only admin can remove
        if removed_by not in group.get("admin_ids", []):
            return

        chat_id = group.get("chat_id")

        # Update group
        db.groups.update_one(
            {"_id": ObjectId(group_id)},
            {
                "$pull": {"members": member_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        # Update chat participants
        if chat_id:
            db.chats.update_one(
                {"_id": ObjectId(chat_id)},
                {"$pull": {"participants": member_id}}
            )

        # Notify member (direct)
        socketio.emit(
            "group:removed",
            {"group_id": group_id, "chat_id": chat_id},
            room=f"user:{member_id}"
        )

        # Notify group room
        if chat_id:
            socketio.emit(
                "group:member_removed",
                {"group_id": group_id, "member_id": member_id},
                room=f"chat:{chat_id}"
            )

    except Exception:
        print("[group:remove_member] error:", traceback.format_exc())
