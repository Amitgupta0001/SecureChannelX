// FILE: src/components/ChatWindow.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

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

import { motion, AnimatePresence } from "framer-motion";
import { Image, Paperclip, Phone, Video, Search } from "lucide-react";

const isSentByMe = (msg, uid) =>
  msg.sender_id === uid || msg.user_id === uid;

export default function ChatWindow({ chat }) {
  const { token, user } = useContext(AuthContext);

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const [text, setText] = useState("");

  const [openThread, setOpenThread] = useState(null);
  const [openSearch, setOpenSearch] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);

  const scrollRef = useRef(null);
  const typingTimeout = useRef(null);

  /** Auto scroll */
  const scrollToBottom = () =>
    setTimeout(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 60);

  /** Fetch messages */
  useEffect(() => {
    if (!chat) return;
    (async () => {
      const data = await messageApi.getMessages(chat._id, token);
      setMessages(data.messages || []);
      scrollToBottom();
    })();
  }, [chat, token]);

  /** Socket: new messages */
  useEffect(() => {
    const handler = ({ message }) => {
      if (message.chat_id === chat._id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
    };

    socket.on("message:new", handler);
    return () => socket.off("message:new", handler);
  }, [chat]);

  /** Typing events */
  useEffect(() => {
    socket.on("typing:started", ({ user_id }) => {
      if (user_id !== user.user_id) setTypingUsers([user_id]);
    });

    socket.on("typing:stopped", ({ user_id }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== user_id));
    });

    return () => {
      socket.off("typing:started");
      socket.off("typing:stopped");
    };
  }, [user.user_id]);

  /** Text input typing indicator */
  const handleTyping = (e) => {
    const val = e.target.value;
    setText(val);

    socket.emit("typing:start", {
      chat_id: chat._id,
      user_id: user.user_id,
    });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing:stop", {
        chat_id: chat._id,
        user_id: user.user_id,
      });
    }, 1200);
  };

  /** Send text message */
  const sendMessage = () => {
    if (!text.trim()) return;

    socket.emit("message:send", {
      chat_id: chat._id,
      message: {
        sender_id: user.user_id,
        content: text,
        message_type: "text",
      },
    });

    setText("");
    socket.emit("typing:stop", {
      chat_id: chat._id,
      user_id: user.user_id,
    });
  };

  /** Upload file */
  const handleFileSend = async (file) => {
    try {
      const res = await fileUploadApi.uploadFile(chat._id, file, token);

      // Broadcast via socket
      socket.emit("message:send", {
        chat_id: chat._id,
        message: res.file_message,
      });
    } catch (err) {
      console.error("File upload failed:", err);
    }
  };

  /** Open thread */
  const openThreadView = (msg) => setOpenThread(msg);

  return (
    <div className="h-full w-full flex relative bg-[#0D1117] text-white">

      {/* THREAD PANEL */}
      {openThread && (
        <ThreadView
          isOpen={!!openThread}
          parentMessage={openThread}
          socket={socket}
          token={token}
          onClose={() => setOpenThread(null)}
        />
      )}

      {/* SEARCH MODAL */}
      {openSearch && (
        <MessageSearch
          roomId={chat._id}
          token={token}
          onClose={() => setOpenSearch(false)}
        />
      )}

      {/* UPLOAD MODAL */}
      {openUpload && (
        <FileUpload
          roomId={chat._id}
          onSend={handleFileSend}
          onClose={() => setOpenUpload(false)}
        />
      )}

      {/* CHAT COLUMN */}
      <div className="flex flex-col flex-1">

        {/* HEADER */}
        <div className="sticky top-0 z-40 px-4 py-3 bg-[#0d1117e8] backdrop-blur-md border-b border-[#1f2937] flex items-center justify-between">
          
          {/* Left side */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1f6feb] to-[#3b82f6] flex items-center justify-center text-lg font-bold shadow-lg">
              {(chat.title || "D")[0]}
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-[17px]">{chat.title}</h3>
              {typingUsers.length > 0 ? (
                <span className="text-xs text-green-400">Typing…</span>
              ) : (
                <span className="text-xs text-gray-400">Active now</span>
              )}
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <Search className="cursor-pointer text-gray-300 hover:text-white" size={20}
              onClick={() => setOpenSearch(true)} />
            <Image className="cursor-pointer text-gray-300 hover:text-white" size={22}
              onClick={() => setOpenUpload(true)} />
            <Phone className="text-gray-300 hover:text-white cursor-pointer" size={22} />
            <Video className="text-gray-300 hover:text-white cursor-pointer" size={22} />
          </div>
        </div>

        {/* MESSAGE LIST */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {messages.map((msg, index) => {
            const sent = isSentByMe(msg, user.user_id);
            const encrypted = msg.encrypted_content && !msg.content;

            // Poll message
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
                  onDoubleClick={() => openThreadView(msg)}
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

          {/* TYPING */}
          <TypingIndicator isTyping={typingUsers.length > 0} />

        </div>

        {/* SMART REPLIES */}
        <SmartReplyBar
          contextMessages={messages}
          token={token}
          onSelectReply={(t) => setText(t)}
        />

        {/* INPUT BAR */}
        <div className="p-3 border-t border-[#1f2937] bg-[#0d1117cc] backdrop-blur-md flex items-center gap-3">

          <input
            value={text}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Message…"
            className="flex-1 px-4 py-2 bg-[#111827] border border-[#1f2937] rounded-full text-sm text-gray-200 
              focus:outline-none focus:ring-1 focus:ring-[#2563eb] placeholder-gray-500"
          />

          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-[#1f6feb] rounded-full hover:bg-[#2563eb] transition active:scale-95"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
