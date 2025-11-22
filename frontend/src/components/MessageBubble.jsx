// FILE: src/components/MessageBubble.jsx
import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react"; // optional icon (requires: npm install lucide-react)

export default function MessageBubble({
  msg,
  isSent,       // true = message sent by current user
  encrypted,    // true = message has encrypted_content
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80 }}
      className={`flex flex-col max-w-[78%] ${
        isSent ? "items-end ml-auto" : "items-start"
      }`}
    >
      {/* MESSAGE BUBBLE */}
      <div
        className={`relative px-4 py-2 rounded-2xl shadow-md text-sm break-words 
          ${isSent 
            ? "bg-[#1f6feb] text-white rounded-br-none" 
            : "bg-[#111827] text-gray-200 rounded-bl-none"
          }
        `}
      >
        {/* ----- CONTENT AREA ----- */}
        {encrypted ? (
          <div className="flex items-center gap-2 opacity-80 italic">
            <ShieldCheck className="w-4 h-4 text-blue-300" />
            <span>Encrypted Message</span>
          </div>
        ) : (
          <span>{msg.content}</span>
        )}

        {/* ----- TIMESTAMP ----- */}
        <div className="text-[10px] opacity-60 mt-1 text-right">
          {new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        {/* ----- REACTIONS (optional) ----- */}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="absolute -bottom-3 right-2 flex gap-1 bg-[#0d1117] border border-[#1f2937] px-2 py-0.5 rounded-full shadow-lg">
            {msg.reactions.map((r, idx) => (
              <span key={idx} className="text-sm">{r.emoji}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
