// FILE: src/components/Modal.jsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Modal({ children, onClose }) {
  
  // Close on ESC key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Modal Box */}
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.15 }}
          className="relative w-[90%] max-w-lg bg-[#111827] border border-[#1f2937] rounded-2xl shadow-xl p-6 text-gray-200"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          >
            ✖
          </button>

          {/* Content */}
          <div className="mt-2">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
