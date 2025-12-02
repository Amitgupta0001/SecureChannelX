/**
 * ✅ ENHANCED: SecureChannelX - File Upload API
 * ---------------------------------------------
 * Encrypted file upload and management
 * 
 * Changes:
 *   - Fixed: API URL to port 5050
 *   - Added: Axios instance with interceptors
 *   - Added: Upload progress tracking
 *   - Added: File validation
 *   - Added: Download file
 *   - Added: Delete file
 *   - Added: Get file metadata
 * 
 * Compatibility:
 *   - Backend API: ✅ Port 5050
 *   - Encryption: ✅ E2EE compatible
 */

import axios from "axios";

// ============================================================
//                   CONFIGURATION
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const API_TIMEOUT = 120000; // 2 minutes for file uploads

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/files`,
  timeout: API_TIMEOUT,
});

// ============================================================
//                   INTERCEPTORS
// ============================================================

api.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization) {
      const token = localStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ============================================================
//                   FILE UPLOAD API
// ============================================================

const fileUploadApi = {
  /**
   * ✅ ENHANCED: Upload file
   */
  async uploadFile(chatId, file, token = null, onProgress = null) {
    try {
      if (!file) {
        throw new Error("File is required");
      }

      if (!chatId) {
        throw new Error("Chat ID is required");
      }

      // Validate file size (100MB max)
      const MAX_SIZE = 100 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new Error("File size exceeds 100MB limit");
      }

      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("file", file);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.post("/upload", formData, {
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });

      return {
        success: true,
        file: response.data.file,
        file_id: response.data.file_id,
        file_url: response.data.file_url,
        message: response.data.message,
      };
    } catch (error) {
      console.error("[File Upload API] Upload error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Download file
   */
  async downloadFile(fileId, token = null) {
    try {
      if (!fileId) {
        throw new Error("File ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get(`/download/${fileId}`, {
        headers,
        responseType: "blob",
      });

      return response.data;
    } catch (error) {
      console.error("[File Upload API] Download error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Get file metadata
   */
  async getFileMetadata(fileId, token = null) {
    try {
      if (!fileId) {
        throw new Error("File ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.get(`/metadata/${fileId}`, { headers });

      return {
        success: true,
        metadata: response.data.metadata,
      };
    } catch (error) {
      console.error("[File Upload API] Get metadata error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Delete file
   */
  async deleteFile(fileId, token = null) {
    try {
      if (!fileId) {
        throw new Error("File ID is required");
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await api.delete(`/${fileId}`, { headers });

      return {
        success: true,
        message: response.data.message || "File deleted successfully",
      };
    } catch (error) {
      console.error("[File Upload API] Delete error:", error.message);
      throw error;
    }
  },

  /**
   * ✅ NEW: Validate file before upload
   */
  validateFile(file) {
    const errors = [];

    // Check if file exists
    if (!file) {
      errors.push("No file provided");
      return { valid: false, errors };
    }

    // Check file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      errors.push("File size exceeds 100MB limit");
    }

    // Check file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "video/mp4",
      "audio/mpeg",
      "audio/wav",
    ];

    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type not allowed: ${file.type}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * ✅ NEW: Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  },

  /**
   * ✅ NEW: Get file icon based on type
   */
  getFileIcon(fileType) {
    const icons = {
      "image/jpeg": "🖼️",
      "image/png": "🖼️",
      "image/gif": "🖼️",
      "application/pdf": "📄",
      "text/plain": "📝",
      "video/mp4": "🎥",
      "audio/mpeg": "🎵",
      "audio/wav": "🎵",
    };

    return icons[fileType] || "📎";
  },
};

export default fileUploadApi;
