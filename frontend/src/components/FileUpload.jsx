import React, { useRef, useState, useContext } from 'react';
import axios from 'axios';
import { Paperclip, X, File, AlertCircle } from 'lucide-react';
import { EncryptionContext } from '../context/EncryptionContext';

const FileUpload = ({ onUploadComplete }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const { encryptFile } = useContext(EncryptionContext);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic validation
    if (file.size > 100 * 1024 * 1024) { // Increased to 100MB
      setError('File size too large (max 100MB)');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();

    try {
      // 1. Encrypt locally
      const { encryptedBlob, originalName, mimeType, encryption } = await encryptFile(file);

      // 2. Prepare upload
      formData.append('file', encryptedBlob, originalName + ".enc"); // Append .enc extension
      formData.append('encrypted', 'true');

      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5050/api/files/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // 3. Complete pass back metadata
      onUploadComplete({
        ...res.data.file,
        original_name: originalName,
        mime_type: mimeType,
        encryption_key: encryption.key,
        encryption_iv: encryption.iv
      });

    } catch (err) {
      console.error("Upload failed", err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        id="file-upload"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors disabled:opacity-50"
        title="Attach file"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-red-500/90 text-white text-sm p-2 rounded shadow-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="hover:text-red-200">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {uploading && (
        <div className="absolute bottom-full left-0 mb-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded shadow-lg">
          Uploading...
        </div>
      )}
    </div>
  );
};

export default FileUpload;
