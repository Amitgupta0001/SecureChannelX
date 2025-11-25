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

export default function ChatWindow({ chat, onBack }) {
  const { token, user } = useContext(AuthContext);
  const {
    encrypt,
    decrypt,
    initChatSession,
    ready: cryptoReady,
    error: cryptoError,
    encryptGroup,
    decryptGroup,
    distributeGroupKey,
    handleDistributionMessage
  } = useContext(EncryptionContext);

  // ... (rest of the component)

  if (!chat) return null;

  if (cryptoError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-red-400 p-4 text-center">
        <div className="mb-2 text-xl">⚠️ Encryption Error</div>
        <div className="text-sm text-gray-400 mb-4">{cryptoError}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Reload Page
        </button>
      </div>
    );
  }

  if (!cryptoReady) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400">
        Initializing secure encryption session…
      </div>
    );
  }

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [text, setText] = useState("");

  const [openThread, setOpenThread] = useState(null);
  const [openSearch, setOpenSearch] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
  /** -------------------------------------------
   * FIX 1 — SAFE PEER ID DETECTION
   * ------------------------------------------- */
  const resolvePeerId = () => {
    if (!chat || !user) return null;

    const me = user.id;

    // 1. Standard expected structure (Array of objects or strings)
    if (Array.isArray(chat.participants)) {
      const other = chat.participants.find((p) => {
        const pid = typeof p === "string" ? p : p.id;
        return pid !== me;
      });
      return other ? (typeof other === "string" ? other : other.id) : null;
    }

    // 2. Some backends use users array
    if (Array.isArray(chat.users)) {
      const other = chat.users.find((p) => {
        const pid = typeof p === "string" ? p : p.id;
        return pid !== me;
      });
      return other ? (typeof other === "string" ? other : other.id) : null;
    }

    // 3. members / recipients
    if (Array.isArray(chat.members)) {
      const other = chat.members.find((p) => {
        const pid = typeof p === "string" ? p : p.id;
        return pid !== me;
      });
      return other ? (typeof other === "string" ? other : other.id) : null;
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
                  } catch { }
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
    if (chat.chat_type === "group") return; // Skip X3DH for groups

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
            } catch { }
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
      if (user_id !== user.id) setTypingUsers([user_id]);
    });

    socket.on("typing:stopped", ({ user_id }) =>
      setTypingUsers((prev) => prev.filter((id) => id !== user_id))
    );

    return () => {
      socket.off("typing:started");
      socket.off("typing:stopped");
    };
  }, [user.id, socket]);

  /** -------------------------------------------
   * Send typing indicator
   * ------------------------------------------- */
  const handleTyping = (e) => {
    const val = e.target.value;
    setText(val);

    if (!socket) return;

    socket.emit("typing:start", {
      chat_id: chat?._id,
      user_id: user?.id
    });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => {
      socket.emit("typing:stop", {
        chat_id: chat?._id,
        user_id: user?.id
      });
    }, 1200);
  };

  // Simple Emoji List
  const emojis = ["😀", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤔", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐", "😯", "😪", "😫", "😴", "😌", "😛", "😜", "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑", "😲", "☹️", "🙁", "😖", "😞", "😟", "😤", "😢", "😭", "😦", "😧", "😨", "😩", "🤯", "😬", "😰", "😱", "🥵", "🥶", "😳", "🤪", "😵", "😡", "😠", "🤬", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "😇", "🥳", "🥺", "🤠", "🤡", "🤥", "🤫", "🤭", "🧐", "🤓", "😈", "👿", "👹", "👺", "💀", "👻", "👽", "🤖", "💩", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐", "🖖", "👋", "🤙", "💪", "🖕", "✍️", "🙏", "💍", "💄", "💋", "👄", "👅", "👂", "👃", "👣", "👁", "👀", "🧠", "🗣", "👤", "👥"];

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
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

      // Auto-retry initialization
      if (err.message === "Chat session not initialized") {
        const peerId = resolvePeerId();
        if (peerId) {
          try {
            console.log("🔄 Retrying encryption session init...");
            await initChatSession(chat._id, peerId);
            // Retry encryption
            if (chat.chat_type === "group") {
              // Group retry logic if needed (omitted for now as error is likely 1:1)
              encryptedData = await encryptGroup(chat._id, text);
            } else {
              encryptedData = await encrypt(chat._id, text);
            }
          } catch (retryErr) {
            console.error("Retry failed:", retryErr);
            alert(`Encryption failed: ${retryErr.message}\n\nEnsure the other user has logged in at least once.`);
            return;
          }
        } else {
          alert("Cannot encrypt: Peer ID missing.");
          return;
        }
      } else {
        alert(`Encryption error: ${err.message}`);
        return;
      }
    }

    socket.emit("message:send", {
      chat_id: chat._id,
      encrypted_content: encryptedData,
      message_type: "text"
    });

    setText("");

    socket.emit("typing:stop", {
      chat_id: chat._id,
      user_id: user.id
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
    <div className="flex flex-col h-full relative bg-[#0b141a] text-[#e9edef]">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#202c33] flex items-center justify-between shrink-0 z-20 border-b border-[#202c33]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-[#aebac1]">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden cursor-pointer">
            {chat.participants && chat.participants[0]?.avatar ? (
              <img src={chat.participants[0].avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#6a7175] text-white font-bold">
                {(chat.title || "D")[0]}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="font-normal text-[16px] text-[#e9edef] leading-tight cursor-pointer">
              {chat.title || "Direct Chat"}
            </h2>
            {typingUsers.length > 0 ? (
              <span className="text-xs text-[#00a884] font-medium">typing...</span>
            ) : (
              <span className="text-xs text-[#8696a0]">click here for contact info</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5 text-[#aebac1]">
          <button
            title="Video Call"
            className="hover:text-white transition"
            onClick={() => alert("Video Call feature coming soon!")}
          >
            <Video size={20} />
          </button>
          <button
            title="Voice Call"
            className="hover:text-white transition"
            onClick={() => alert("Voice Call feature coming soon!")}
          >
            <Phone size={20} />
          </button>
          <div className="w-[1px] h-6 bg-[#374248] mx-1"></div>
          <button title="Search" className="hover:text-white transition" onClick={() => setOpenSearch(true)}>
            <Search size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#0b141a] relative"
        ref={messagesEndRef}
        style={{
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "400px",
          backgroundBlendMode: "overlay",
          backgroundColor: "#0b141a"
        }}
      >
        {/* Encryption Notice */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#182229] text-[#ffd279] text-xs px-3 py-1.5 rounded-lg shadow-sm text-center max-w-[90%]">
            <span className="mr-1">🔒</span> Messages are end-to-end encrypted. No one outside of this chat, not even SecureChannelX, can read or listen to them.
          </div>
        </div>

        {messages.map((msg, index) => {
          const sent = isSentByMe(msg, user.id);
          const encrypted = msg.encrypted_content && !msg.content;

          if (msg.message_type === "poll") {
            return (
              <PollCard
                key={msg._id || index}
                poll={msg.extra}
                token={token}
                currentUserId={user.id}
              />
            );
          }

          return (
            <div key={msg._id || index} className={`flex ${sent ? "justify-end" : "justify-start"} mb-1 group`}>
              <div
                className="max-w-[85%] md:max-w-[65%]"
                onDoubleClick={() => setOpenThread(msg)}
              >
                <MessageBubble
                  msg={msg}
                  isSent={sent}
                  encrypted={encrypted}
                />

                {/* Reaction Bar */}
                <div className={`absolute -top-8 ${sent ? "right-0" : "left-0"} opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
                  <ReactionBar
                    messageId={msg._id}
                    chatId={chat._id}
                    token={token}
                    currentUserId={user.id}
                    existingReactions={msg.reactions || []}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SmartReplyBar
        contextMessages={messages}
        token={token}
        onSelectReply={(t) => setText(t)}
      />

      {/* Input Area */}
      <div className="px-4 py-2 bg-[#202c33] flex items-end gap-2 shrink-0 z-20 relative">
        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-4 bg-[#202c33] border border-[#374045] rounded-lg shadow-xl p-2 w-72 h-64 overflow-y-auto grid grid-cols-8 gap-1 z-50">
            {emojis.map(e => (
              <button
                key={e}
                onClick={() => addEmoji(e)}
                className="hover:bg-[#374045] p-1 rounded text-xl"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <button
          className={`p-2 transition mb-1 ${showEmojiPicker ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#aebac1]"}`}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
        </button>
        <button
          onClick={() => setOpenUpload(true)}
          className="p-2 text-[#8696a0] hover:text-[#aebac1] transition mb-1"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
        </button>

        <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center min-h-[42px] mb-1">
          <input
            value={text}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message"
            className="w-full bg-transparent border-none outline-none text-[#e9edef] placeholder-[#8696a0] px-4 py-2 text-[15px]"
          />
        </div>

        {text.trim() ? (
          <button
            onClick={sendMessage}
            className="p-2 text-[#8696a0] hover:text-[#00a884] transition mb-1"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
          </button>
        ) : (
          <button
            className="p-2 text-[#8696a0] hover:text-[#aebac1] transition mb-1"
            onClick={() => alert("Voice Message feature coming soon!")}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </button>
        )}
      </div>

      {/* Modals */}
      {openThread && (
        <ThreadView
          isOpen={!!openThread}
          parentMessage={openThread}
          socket={socket}
          token={token}
          onClose={() => setOpenThread(null)}
        />
      )}

      {openSearch && (
        <MessageSearch
          roomId={chat._id}
          token={token}
          onClose={() => setOpenSearch(false)}
        />
      )}

      {openUpload && (
        <FileUpload
          roomId={chat._id}
          onSend={() => setOpenUpload(false)}
          onClose={() => setOpenUpload(false)}
        />
      )}

      <SafetyNumberModal
        isOpen={showSafetyModal}
        onClose={() => setShowSafetyModal(false)}
        peerId={resolvePeerId()}
        peerName={chat.title}
      />
    </div>
  );
}
