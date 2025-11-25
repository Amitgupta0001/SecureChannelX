// FILE: src/services/callService.js

import axios from "axios";
import { API_BASE as API } from "../utils/constants";

/** Auth header using correct token key */
const auth = () => ({
  headers: { Authorization: "Bearer " + localStorage.getItem("access_token") }
});

/* ------------------------------------------------------
   START AUDIO OR VIDEO CALL
-------------------------------------------------------- */
export async function startCall(chatId, receiverId, callType = "video") {
  try {
    const res = await axios.post(
      `${API}/calls/start`,
      {
        chat_id: chatId,
        receiver_id: receiverId,
        call_type: callType,
      },
      auth()
    );

    return res.data.data;
  } catch (err) {
    console.error("startCall error:", err.response?.data || err);
    return { error: "Failed to start call." };
  }
}

/* ------------------------------------------------------
   ACCEPT CALL
-------------------------------------------------------- */
export async function acceptCall(callId) {
  try {
    const res = await axios.post(
      `${API}/calls/${callId}/accept`,
      {},
      auth()
    );
    return res.data.data;
  } catch (err) {
    console.error("acceptCall error:", err.response?.data || err);
    return { error: "Failed to accept call." };
  }
}

/* ------------------------------------------------------
   REJECT CALL
-------------------------------------------------------- */
export async function rejectCall(callId) {
  try {
    const res = await axios.post(
      `${API}/calls/${callId}/reject`,
      {},
      auth()
    );
    return res.data.data;
  } catch (err) {
    console.error("rejectCall error:", err.response?.data || err);
    return { error: "Failed to reject call." };
  }
}

/* ------------------------------------------------------
   END CALL (hang up)
-------------------------------------------------------- */
export async function endCall(callId) {
  try {
    const res = await axios.post(
      `${API}/calls/${callId}/end`,
      {},
      auth()
    );
    return res.data.data;
  } catch (err) {
    console.error("endCall error:", err.response?.data || err);
    return { error: "Failed to end call." };
  }
}

/* ------------------------------------------------------
   GET CALL HISTORY FOR CHAT
-------------------------------------------------------- */
export async function getCallHistory(chatId) {
  try {
    const res = await axios.get(
      `${API}/calls/history/${chatId}`,
      auth()
    );
    return res.data.data;
  } catch (err) {
    console.error("getCallHistory error:", err.response?.data || err);
    return { error: "Failed to load history." };
  }
}

/* ------------------------------------------------------
   DEFAULT EXPORT (so import callApi works)
-------------------------------------------------------- */
const callApi = {
  startCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory
};

export default callApi;
