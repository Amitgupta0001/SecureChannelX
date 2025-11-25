import axios from "axios";

const API_URL = "http://localhost:5050/api/keys";

export const uploadBundle = async (bundle, token) => {
    try {
        const res = await axios.post(`${API_URL}/bundle`, bundle, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return res.data;
    } catch (err) {
        console.error("Error uploading bundle:", err);
        throw err;
    }
};

export const getBundle = async (userId, token) => {
    try {
        const res = await axios.get(`${API_URL}/bundle/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return res.data.data;
    } catch (err) {
        console.error("Error fetching bundle:", err);
        throw err;
    }
};

export default {
    uploadBundle,
    getBundle,
};
