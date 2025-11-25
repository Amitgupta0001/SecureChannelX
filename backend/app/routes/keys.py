from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.key_bundle import KeyBundle
from app.utils.response_builder import success, error

keys_bp = Blueprint("keys", __name__, url_prefix="/api/keys")

@keys_bp.route("/bundle", methods=["POST"])
@jwt_required()
def upload_bundle():
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        required = ["identity_key", "signed_pre_key", "kyber_pre_key"]
        if not all(k in data for k in required):
            return error("Missing key fields", 400)
            
        KeyBundle.save_bundle(user_id, data)
        return success("Key bundle uploaded successfully")
        
    except Exception as e:
        return error(f"Failed to upload bundle: {str(e)}", 500)

@keys_bp.route("/bundle/<user_id>", methods=["GET"])
@jwt_required()
def get_bundle(user_id):
    try:
        bundle = KeyBundle.get_bundle(user_id)
        if not bundle:
            return error("Key bundle not found", 404)
            
        return success(data=bundle)
        
    except Exception as e:
        return error(f"Failed to fetch bundle: {str(e)}", 500)
