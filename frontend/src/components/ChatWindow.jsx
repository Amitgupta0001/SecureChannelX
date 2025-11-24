// FILE: src/components/ChatWindow.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { EncryptionContext } from "../context/EncryptionContext";

import messageApi from "../api/messageApi";
import fileUploadApi from "../api/fileUploadApi";

import socket from "../sockets/socket";

// UI Components
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ReactionBar from "./ReactionBar";
import SmartReplyBar from "./SmartReplyBar";
import PollCard from "./PollCard";
import ThreadView from "./ThreadView";
import MessageSearch from "./MessageSearch";
import FileUpload from "./FileUpload";
import SafetyNumberModal from "./SafetyNumberModal";

import { Image, Phone, Video, Search } from "lucide-react";

const isSentByMe = (msg, uid) =>
  msg.sender_id === uid || msg.user_id === uid;

export default function ChatWindow({ chat }) {
  const { token, user } = useContext(AuthContext);
  const {
    encrypt,
    decrypt,
    initChatSession,
    ready: cryptoReady,
    encryptGroup,
    decryptGroup,
    distributeGroupKey,
    handleDistributionMessage
  } = useContext(EncryptionContext);

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [text, setText] = useState("");

  const [openThread, setOpenThread] = useState(null);
  const [openSearch, setOpenSearch] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  const scrollToBottom = () =>
    setTimeout(() => {
      if (messagesEndRef.current)
        messagesEndRef.current.scrollTop =
          messagesEndRef.current.scrollHeight;
    }, 60);

  /** -------------------------------------------
   * FIX 1 — SAFE PEER ID DETECTION
   * ------------------------------------------- */
  const resolvePeerId = () => {
    if (!chat || !user) return null;

    const me = user.user_id;

    // 1. Standard expected structure
    if (Array.isArray(chat.participants)) {
      return chat.participants.find((id) => id !== me) || null;
    }

    // 2. Some backends use users array
    if (Array.isArray(chat.users)) {
      return chat.users.find((id) => id !== me) || null;
    }

    // 3. members / recipients
    if (Array.isArray(chat.members)) {
      return chat.members.find((id) => id !== me) || null;
    }

    // 4. If chat contains nested objects
    if (chat.user && chat.user.id && chat.user.id !== me)
      return chat.user.id;

    if (chat.receiverId && chat.receiverId !== me)
      return chat.receiverId;

    if (chat.senderId && chat.senderId !== me)
      return chat.senderId;

    if (chat.otherUserId && chat.otherUserId !== me)
      return chat.otherUserId;

    if (chat.to && chat.to !== me) return chat.to;
    if (chat.from && chat.from !== me) return chat.from;

    // 5. Fallback: If chat has a single other user field
    for (const key of Object.keys(chat)) {
      if (typeof chat[key] === "string" && chat[key] !== me) {
        if (chat[key].length === 24) return chat[key]; // mongo ObjectId-like
      }
    }

    console.error("❌ No peerId found for chat:", chat);
    return null;
  };

  /** -------------------------------------------
   * Fetch messages & decrypt them
   * ------------------------------------------- */
  useEffect(() => {
    if (!chat) return;

    (async () => {
      try {
        const data = await messageApi.getMessages(chat._id, token);
        const raw = data.messages || [];

        const decrypted = await Promise.all(
          raw.map(async (msg) => {
            if (msg.encrypted_content && msg.e2e_encrypted) {
              try {
                let ec = msg.encrypted_content;
                if (typeof ec === "string") {
                  try {
                    ec = JSON.parse(ec);
                  } catch {}
                }

                let plaintext;
                if (chat.chat_type === "group") {
                  plaintext = await decryptGroup(chat._id, msg.sender_id, {
                    ciphertext: ec.ciphertext,
                    nonce: ec.nonce,
                    step: ec.step
                  });
                } else {
                  plaintext = await decrypt(chat._id, {
                    header: ec.header || msg.header,
                    ciphertext: ec.ciphertext,
                    nonce: ec.nonce,
                    x3dh_header: msg.x3dh_header
                  });
                }

                return { ...msg, content: plaintext, isDecrypted: true };
              } catch (e) {
                console.error("Decryption failed", e);
                return {
                  ...msg,
                  content: "⚠️ Decryption Failed",
                  isError: true
                };
              }
            }
            return msg;
          })
        );

        setMessages(decrypted);
        scrollToBottom();
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    })();
  }, [chat, token, decrypt]);

  /** -------------------------------------------
   * FIX 2 — Initialize Encryption Session Safely
   * ------------------------------------------- */
  useEffect(() => {
    if (!chat || !user || !cryptoReady) return;

    const peerId = resolvePeerId();
    if (!peerId) {
      console.warn("Cannot init session — peerId missing");
      return;
    }

    initChatSession(chat._id, peerId).catch((err) =>
      console.error("Failed to init encryption session:", err)
    );
  }, [chat, user, cryptoReady]);

  /** -------------------------------------------
   * Socket real-time messages
   * ------------------------------------------- */
  useEffect(() => {
    const handler = async ({ message }) => {
      if (!chat || message.chat_id !== chat._id) return;

      let decryptedMsg = message;

      if (message.encrypted_content && message.e2e_encrypted) {
        try {
          let ec = message.encrypted_content;
          if (typeof ec === "string") {
            try {
              ec = JSON.parse(ec);
            } catch {}
          }

          const plaintext = await decrypt(chat._id, {
            header: ec.header,
            ciphertext: ec.ciphertext,
            nonce: ec.nonce,
            x3dh_header: message.x3dh_header
          });

          decryptedMsg = { ...message, content: plaintext, isDecrypted: true };
        } catch (e) {
          decryptedMsg = {
            ...message,
            content: "⚠️ Decryption Failed",
            isError: true
          };
        }
      }

      setMessages((prev) => [...prev, decryptedMsg]);
      scrollToBottom();
    };

    if (!socket) return;
    socket.on("message:new", handler);

    return () => socket.off("message:new", handler);
  }, [chat, decrypt]);

  /** -------------------------------------------
   * Typing events
   * ------------------------------------------- */
  useEffect(() => {
    if (!socket) return;

    socket.on("typing:started", ({ user_id }) => {
      if (user_id !== user.user_id) setTypingUsers([user_id]);
    });

    socket.on("typing:stopped", ({ user_id }) =>
      setTypingUsers((prev) => prev.filter((id) => id !== user_id))
    );

    return () => {
      socket.off("typing:started");
      socket.off("typing:stopped");
    };
  }, [user.user_id, socket]);

  /** -------------------------------------------
   * Send typing indicator
   * ------------------------------------------- */
  const handleTyping = (e) => {
    const val = e.target.value;
    setText(val);

    if (!socket) return;

    socket.emit("typing:start", {
      chat_id: chat?._id,
      user_id: user?.user_id
    });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      socket.emit("typing:stop", {
        chat_id: chat?._id,
        user_id: user?.user_id
      });
    }, 1200);
  };

  /** -------------------------------------------
   * Send Message
   * ------------------------------------------- */
  const sendMessage = async () => {
    if (!text.trim()) return;

    const peerId = resolvePeerId();
    if (!peerId) {
      alert("Cannot encrypt — peer not found");
      return;
    }

    let encryptedData;

    try {
      if (chat.chat_type === "group") {
        try {
          encryptedData = await encryptGroup(chat._id, text);
        } catch (e) {
          if (e.message === "GROUP_KEY_MISSING") {
            const dist = await distributeGroupKey(chat._id, chat.participants || []);
            dist.forEach((d) =>
              socket.emit("private_message", {
                to_user_id: d.userId,
                encrypted_content: d.content
              })
            );
            encryptedData = await encryptGroup(chat._id, text);
          }
        }
      } else {
        encryptedData = await encrypt(chat._id, text);
      }
    } catch (err) {
      console.error("Encryption failed:", err);
      alert("Encryption session not ready.");
      return;
    }

    socket.emit("message:send", {
      chat_id: chat._id,
      encrypted_content: encryptedData,
      message_type: "text"
    });

    setText("");

    socket.emit("typing:stop", {
      chat_id: chat._id,
      user_id: user.user_id
    });
  };

  /** -------------------------------------------
   * UI States
   * ------------------------------------------- */

  if (!chat) return null;

  if (!cryptoReady) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400">
        Initializing secure encryption session…
      </div>
    );
  }

  return (
    <div className="h-full w-full flex relative bg-[#0D1117] text-white">
      {/* Thread Panel */}
      {openThread && (
        <ThreadView
          isOpen={!!openThread}
          parentMessage={openThread}
          socket={socket}
          token={token}
          onClose={() => setOpenThread(null)}
        />
      )}

      {/* Search Modal */}
      {openSearch && (
        <MessageSearch
          roomId={chat._id}
          token={token}
          onClose={() => setOpenSearch(false)}
        />
      )}

      {/* Upload Modal */}
      {openUpload && (
        <FileUpload
          roomId={chat._id}
          onSend={() => setOpenUpload(false)}
          onClose={() => setOpenUpload(false)}
        />
      )}

      {/* Chat Column */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <div className="sticky top-0 z-40 px-4 py-3 bg-[#0d1117e8] backdrop-blur-md border-b border-[#1f2937] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] flex items-center justify-center text-lg font-bold shadow-lg">
              {(chat.title || "D")[0]}
            </div>
            <div className="flex flex-col">
              <h2 className="font-semibold flex items-center gap-2">
                {chat.title || "Direct Chat"}
                <button
                  onClick={() => setShowSafetyModal(true)}
                  className="text-xs bg-[#1f2937] hover:bg-[#30363d] text-green-400 px-2 py-0.5 rounded border border-green-900/30 transition"
                >
                  Verify
                </button>
              </h2>
              {typingUsers.length > 0 ? (
                <span className="text-xs text-green-400">Typing…</span>
              ) : (
                <span className="text-xs text-gray-400">Active now</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Search
              className="cursor-pointer text-gray-300 hover:text-white"
              size={20}
              onClick={() => setOpenSearch(true)}
            />
            <Image
              className="cursor-pointer text-gray-300 hover:text-white"
              size={22}
              onClick={() => setOpenUpload(true)}
            />
            <Phone
              className="text-gray-300 hover:text-white cursor-pointer"
              size={22}
            />
            <Video
              className="text-gray-300 hover:text-white cursor-pointer"
              size={22}
            />
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesEndRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {messages.map((msg, index) => {
            const sent = isSentByMe(msg, user.user_id);
            const encrypted = msg.encrypted_content && !msg.content;

            if (msg.message_type === "poll") {
              return (
                <PollCard
                  key={msg._id || index}
                  poll={msg.extra}
                  token={token}
                  currentUserId={user.user_id}
                />
              );
            }

            return (
              <div key={msg._id || index} className="relative">
                <div
                  className="active:scale-[0.98] transition-transform"
                  onDoubleClick={() => setOpenThread(msg)}
                >
                  <MessageBubble
                    msg={msg}
                    isSent={sent}
                    encrypted={encrypted}
                  />
                </div>

                <ReactionBar
                  messageId={msg._id}
                  chatId={chat._id}
                  token={token}
                  currentUserId={user.user_id}
                  existingReactions={msg.reactions || []}
                />
              </div>
            );
          })}

          <TypingIndicator isTyping={typingUsers.length > 0} />
        </div>

        <SmartReplyBar
          contextMessages={messages}
          token={token}
          onSelectReply={(t) => setText(t)}
        />

        {/* Input */}
        <div className="p-3 border-t border-[#1f2937] bg-[#0d1117cc] backdrop-blur-md flex items-center gap-3">
          <input
            value={text}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Message…"
            className="flex-1 px-4 py-2 bg-[#111827] border border-[#1f2937] rounded-full text-sm text-gray-200 focus:outline-none"
          />

          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-[#1f6feb] rounded-full hover:bg-[#2563eb] transition active:scale-95"
          >
            Send
          </button>
        </div>
      </div>

      <SafetyNumberModal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        peerId={resolvePeerId()}
        peerName={chat.title}
      />
    </div>
  );
}
