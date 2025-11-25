// FILE: src/components/MessageBubble.jsx
import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, FileText, Download } from "lucide-react";
import { decryptAesGcm, fromBase64 } from "../lib/crypto/primitives";
import { useState, useEffect } from "react";

export default function MessageBubble({
  msg,
  isSent,       // true = message sent by current user
  encrypted,    // true = message has encrypted_content
}) {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState("");
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (msg.message_type === "file" && msg.isDecrypted && msg.content) {
      (async () => {
        setDecrypting(true);
        try {
          const metadata = JSON.parse(msg.content);
          setFileName(metadata.fileName || "file");

          // Fetch encrypted blob
          const res = await fetch(metadata.url);
          const blob = await res.blob();
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);

          // Decrypt
          const key = fromBase64(metadata.key);
          const nonce = fromBase64(metadata.nonce);
          const plaintext = decryptAesGcm(key, bytes, nonce);

          // Create Blob URL
          const decryptedBlob = new Blob([plaintext], { type: metadata.mimeType });
          const url = URL.createObjectURL(decryptedBlob);
          setFileUrl(url);
        } catch (e) {
          console.error("File decrypt failed", e);
        } finally {
          setDecrypting(false);
        }
      })();
    }
  }, [msg]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 80 }}
      className={`flex flex-col max-w-[78%] ${isSent ? "items-end ml-auto" : "items-start"
        }`}
    >
      {/* MESSAGE BUBBLE */}
      <div
        className={`relative px-4 py-2 rounded-lg shadow-sm text-sm break-words max-w-full
          ${isSent
            ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
            : "bg-[#202c33] text-[#e9edef] rounded-tl-none"
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

        {/* ----- FILE CONTENT ----- */}
        {msg.message_type === "file" && fileUrl && (
          <div className="mt-2">
            {msg.content.includes("image") ? (
              <img src={fileUrl} alt="Encrypted" className="max-w-full rounded-lg" />
            ) : (
              <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg">
                <FileText className="w-5 h-5" />
                <a href={fileUrl} download={fileName} className="underline text-sm truncate max-w-[150px]">
                  {fileName}
                </a>
                <Download className="w-4 h-4 opacity-70" />
              </div>
            )}
          </div>
        )}
        {msg.message_type === "file" && decrypting && (
          <div className="mt-2 text-xs opacity-70">Decrypting file...</div>
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
