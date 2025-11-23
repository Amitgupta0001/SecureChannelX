// FILE: src/api/dmApi.js
import axios from "axios";
import { API_BASE } from "../utils/constants";

const API = API_BASE;

export default {
  // -------------------------------------------------------
  // 1️⃣ OPEN DM
  // POST /dm/open/:other_user_id
  // Returns existing DM chat OR creates a new one
  // -------------------------------------------------------
  async openDM(otherUserId, token) {
    const res = await axios.post(
      `${API}/api/direct/open/${otherUserId}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return res.data;
    /*
      {
        chat: {
          _id,
          chat_type: "private",
          participants: [...],
          created_at,
        }
      }
    */
  },

  // -------------------------------------------------------
  // 2️⃣ GET DM MESSAGES
  // GET /dm/room/:other_user_id
  // Fetch entire DM chat history sorted oldest → newest
  // -------------------------------------------------------
  async getDMMessages(otherUserId, token) {
    const res = await axios.get(`${API}/api/direct/room/${otherUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.data;
    /*
      {
        messages: [
          {
            _id,
            chat_id,
            sender_id,
            content,
            created_at,
            ...
          }
        ]
      }
    */
  },

  // -------------------------------------------------------
  // 3️⃣ SOCKET HELPERS — Match backend DM room logic
  // backend room pattern: "dm:{smallerId}:{biggerId}"
  // -------------------------------------------------------

  /**
   * Generate room name exactly like backend deterministic DM room naming.
   * Matches:
   *   dm_room_name(userA, userB) backend logic:
   *   a, b = sorted([userA, userB])
   *   return f"dm:{a}:{b}"
   */
  getDMRoomName(userA, userB) {
    const a = String(userA);
    const b = String(userB);
    const [minId, maxId] = [a, b].sort();
    return `dm:${minId}:${maxId}`;
  },

  // JOIN DM ROOM
  joinDMRoom(socket, userA, userB) {
    const room = this.getDMRoomName(userA, userB);
    socket.emit("join_chat", { chat_id: room, user_id: userA });
    return room;
  },

  // LEAVE DM ROOM
  leaveDMRoom(socket, userA, userB) {
    const room = this.getDMRoomName(userA, userB);
    socket.emit("leave_chat", { chat_id: room, user_id: userA });
  },

  // -------------------------------------------------------
  // 4️⃣ SEND DM MESSAGE (Real-time)
  // Uses the same `"message:send"` socket event as normal chats
  // -------------------------------------------------------
  sendDMMessage(socket, dmRoomId, senderId, content) {
    socket.emit("message:send", {
      chat_id: dmRoomId,
      message: {
        sender_id: senderId,
        content: content,
        message_type: "text",
      },
    });
  },
};
