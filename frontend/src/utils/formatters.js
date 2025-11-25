// FILE: src/utils/formatters.js

/* ---------------------------------------------------------
   FORMAT TIMESTAMP → "10:32 PM" OR "Yesterday" OR "Nov 21"
--------------------------------------------------------- */
export function formatTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ---------------------------------------------------------
   FORMAT FULL DATETIME → "21 Nov 2025, 10:41 PM"
--------------------------------------------------------- */
export function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------------------------------------------------------
   MESSAGE PREVIEW (SIDEBAR)
--------------------------------------------------------- */
export function formatMessagePreview(message) {
  if (!message) return "";

  if (message.message_type === "file") return "📎 File";
  if (message.message_type === "image") return "🖼 Image";
  if (message.message_type === "video") return "🎥 Video";
  if (message.message_type === "audio") return "🎤 Audio";
  if (message.message_type === "poll") return "📊 Poll";
  if (message.message_type === "system") return "⚠ System Message";

  if (message.encrypted_content && !message.content)
    return "🔒 Encrypted message";

  // Limit preview length
  return message.content?.slice(0, 40) || "";
}

/* ---------------------------------------------------------
   USERNAME FORMATTER → Capitalize
--------------------------------------------------------- */
export function formatUsername(username) {
  if (!username) return "Unknown";
  return username.charAt(0).toUpperCase() + username.slice(1);
}

/* ---------------------------------------------------------
   FILE SIZE FORMATTER
--------------------------------------------------------- */
export function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/* ---------------------------------------------------------
   CHAT TITLE FORMATTER (fallback for DM/group)
--------------------------------------------------------- */
export function formatChatTitle(chat) {
  if (!chat) return "Unknown Chat";

  if (chat.title) return chat.title;

  if (chat.is_dm && chat.other_user)
    return formatUsername(chat.other_user.username);

  return "Unnamed Chat";
}

/* ---------------------------------------------------------
   AVATAR INITIAL (fallback)
--------------------------------------------------------- */
export function getAvatarInitial(title) {
  if (!title) return "?";
  return title.charAt(0).toUpperCase();
}

/* ---------------------------------------------------------
   POLL RESULTS FORMATTER
--------------------------------------------------------- */
export function formatPollResults(options = []) {
  return options.map((opt) => ({
    ...opt,
    percentage:
      opt.votes && opt.total_votes
        ? ((opt.votes / opt.total_votes) * 100).toFixed(1)
        : "0.0",
  }));
}

/* ---------------------------------------------------------
   REACTION COUNT (👍 x 3 → {emoji:count})
--------------------------------------------------------- */
export function countReactions(reactions = []) {
  const map = {};

  reactions.forEach((r) => {
    map[r.emoji] = (map[r.emoji] || 0) + 1;
  });

  return map;
}
