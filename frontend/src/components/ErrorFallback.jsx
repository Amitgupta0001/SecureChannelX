// FILE: src/components/ErrorFallback.jsx
import React from "react";
import { motion } from "framer-motion";

export default function ErrorFallback({ error, onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-full flex flex-col justify-center items-center bg-[#0D1117] text-white p-6"
    >
      <div className="bg-[#111827] border border-red-600/40 shadow-xl rounded-xl p-8 max-w-lg w-full text-center">
        
        <h2 className="text-2xl font-semibold text-red-400 mb-3">
          Something went wrong
        </h2>

        <p className="text-gray-400 mb-6">
          {error?.message || "An unexpected error occurred."}
        </p>

        <button
          onClick={onReset}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-white font-medium shadow"
        >
          Reload Component
        </button>

        <div className="text-xs text-gray-500 mt-4">
          Error logged for diagnostics.
        </div>
      </div>
    </motion.div>
  );
}
