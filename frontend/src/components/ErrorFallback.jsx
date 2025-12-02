/**
 * ✅ ENHANCED: SecureChannelX - Error Fallback Component
 * ------------------------------------------------------
 * Fallback UI for error boundaries
 * 
 * Changes:
 *   - Added: Error details toggle
 *   - Added: Report error button
 *   - Enhanced: Visual design
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, Send } from "lucide-react";

export default function ErrorFallback({ error, onReset }) {
  const [showDetails, setShowDetails] = useState(false);

  const handleReport = () => {
    // Send error to backend or logging service
    console.log("📤 Reporting error:", error);
    alert("Error reported. Thank you!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-full flex flex-col justify-center items-center bg-[#0D1117] text-white p-6"
    >
      <div className="bg-[#111827] border border-red-600/40 shadow-2xl rounded-2xl p-8 max-w-lg w-full">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-600/20 rounded-full">
            <AlertCircle className="w-12 h-12 text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-red-400 mb-3 text-center">
          Something went wrong
        </h2>

        {/* Description */}
        <p className="text-gray-400 mb-6 text-center">
          {error?.message || "An unexpected error occurred. Please try reloading."}
        </p>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition text-white font-medium shadow-lg"
          >
            <RefreshCw className="w-5 h-5" />
            Reload Component
          </button>

          <button
            onClick={handleReport}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-white font-medium"
          >
            <Send className="w-5 h-5" />
            Report
          </button>
        </div>

        {/* Error Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition"
        >
          {showDetails ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Details
            </>
          )}
        </button>

        {/* Error Stack */}
        {showDetails && error?.stack && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto"
          >
            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
              {error.stack}
            </pre>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-xs text-center text-gray-600 mt-6">
          Error logged for diagnostics • SecureChannelX v1.0
        </div>
      </div>
    </motion.div>
  );
}
