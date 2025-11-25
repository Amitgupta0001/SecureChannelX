import axios from "axios";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export default {
  async uploadFile(chatId, file, token) {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("file", file);

    const res = await axios.post(`${API}/upload/file`, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  },
};
