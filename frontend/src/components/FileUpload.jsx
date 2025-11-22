// FILE: src/components/FileUpload.jsx
import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileImage, FileVideo, FileText, X } from "lucide-react";

export default function FileUpload({ roomId, onClose, onSend }) {
  const [file, setFile] = useState(null);
  const dropRef = useRef(null);

  const handleSelect = (e) => {
    setFile(e.target.files[0]);
  };

  const sendFile = () => {
    if (!file) return;
    onSend(file);
    setFile(null);
    onClose();
  };

  const detectTypeIcon = () => {
    if (!file) return null;
    const type = file.type;

    if (type.startsWith("image/")) return <FileImage className="w-6 h-6 text-blue-400" />;
    if (type.startsWith("video/")) return <FileVideo className="w-6 h-6 text-purple-400" />;
    return <FileText className="w-6 h-6 text-gray-300" />;
  };

  // Drag and Drop
  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const prevent = (e) => e.preventDefault();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-[90%] max-w-md bg-[#0D1117] text-white border border-[#1f2937] rounded-2xl shadow-xl p-5"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Upload File</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#1f2937] transition"
            >
              <X size={22} className="text-gray-300" />
            </button>
          </div>

          {/* Drag-drop area */}
          <div
            ref={dropRef}
            className="border-2 border-dashed border-[#1f2937] rounded-xl p-6 text-center bg-[#111827] hover:bg-[#1a2333] transition cursor-pointer"
            onDragOver={prevent}
            onDragEnter={prevent}
            onDrop={handleDrop}
          >
            <UploadCloud className="w-12 h-12 mx-auto mb-3 text-blue-500" />
            <p className="text-gray-300 mb-2">
              Drag & drop a file here, or click to select.
            </p>

            <input
              type="file"
              onChange={handleSelect}
              className="hidden"
              id="fileSelector"
            />
            <label
              htmlFor="fileSelector"
              className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm"
            >
              Browse Files
            </label>
          </div>

          {/* Preview */}
          {file && (
            <div className="mt-5 p-4 rounded-xl bg-[#111827] border border-[#1f2937]">
              <div className="flex items-center gap-3">
                {detectTypeIcon()}
                <div className="flex-1">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <button
                onClick={sendFile}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 rounded-full py-2 transition font-medium"
              >
                Send File
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
