// FILE: src/utils/formatters.js

/**
 * Formatting utilities for SecureChannelX
 * @module utils/formatters
 */

/* ========================================
   DATE & TIME FORMATTING
======================================== */
export function formatTimestamp(timestamp) {
  if (!timestamp) return "";
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Invalid date";
    
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return "Just now";

    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
    }

    // Today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }

    // This week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }

    // Older
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
    });
  } catch (err) {
    console.error("formatTimestamp error:", err);
    return "";
  }
}

export function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch (err) {
    console.error("formatMessageTime error:", err);
    return "";
  }
}

export function formatFullDateTime(timestamp) {
  if (!timestamp) return "";
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    
    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (err) {
    console.error("formatFullDateTime error:", err);
    return "";
  }
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    
    const now = new Date();
    const diff = Math.abs(now - date);

    const units = [
      { label: "year", ms: 31536000000 },
      { label: "month", ms: 2592000000 },
      { label: "week", ms: 604800000 },
      { label: "day", ms: 86400000 },
      { label: "hour", ms: 3600000 },
      { label: "minute", ms: 60000 },
      { label: "second", ms: 1000 },
    ];

    for (const unit of units) {
      const value = Math.floor(diff / unit.ms);
      if (value >= 1) {
        return `${value} ${unit.label}${value > 1 ? "s" : ""} ago`;
      }
    }

    return "Just now";
  } catch (err) {
    console.error("formatRelativeTime error:", err);
    return "";
  }
}

export function formatDateSeparator(timestamp) {
  if (!timestamp) return "";
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return "Today";
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    
    // Within last 7 days
    const diff = now - date;
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: "long" });
    }
    
    // Older
    return date.toLocaleDateString([], { 
      month: "long", 
      day: "numeric",
      year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined 
    });
  } catch (err) {
    console.error("formatDateSeparator error:", err);
    return "";
  }
}

/* ========================================
   FILE SIZE FORMATTING
======================================== */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  if (bytes < 0) return "Invalid size";
  
  try {
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  } catch (err) {
    console.error("formatFileSize error:", err);
    return "Unknown size";
  }
}

export function formatDownloadSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return "0 B/s";
  
  try {
    const k = 1024;
    const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    
    return `${parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  } catch (err) {
    console.error("formatDownloadSpeed error:", err);
    return "0 B/s";
  }
}

/* ========================================
   NUMBER FORMATTING
======================================== */
export function formatNumber(num) {
  if (num === null || num === undefined) return "0";
  
  try {
    const parsed = typeof num === "string" ? parseFloat(num) : num;
    
    if (isNaN(parsed)) return "0";
    
    if (parsed >= 1000000000) {
      return (parsed / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
    }
    
    if (parsed >= 1000000) {
      return (parsed / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    
    if (parsed >= 1000) {
      return (parsed / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    
    return parsed.toString();
  } catch (err) {
    console.error("formatNumber error:", err);
    return "0";
  }
}

export function formatCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined) return "$0.00";
  
  try {
    const parsed = typeof amount === "string" ? parseFloat(amount) : amount;
    
    if (isNaN(parsed)) return "$0.00";
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(parsed);
  } catch (err) {
    console.error("formatCurrency error:", err);
    return "$0.00";
  }
}

export function formatPercentage(value, decimals = 0) {
  if (value === null || value === undefined) return "0%";
  
  try {
    const parsed = typeof value === "string" ? parseFloat(value) : value;
    
    if (isNaN(parsed)) return "0%";
    
    return `${parsed.toFixed(decimals)}%`;
  } catch (err) {
    console.error("formatPercentage error:", err);
    return "0%";
  }
}

export function formatPhoneNumber(phone) {
  if (!phone) return "";
  
  try {
    const cleaned = phone.replace(/\D/g, "");
    
    // US/Canada format
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    // With country code
    if (cleaned.length === 11 && cleaned[0] === "1") {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    // International
    if (cleaned.length > 10) {
      return `+${cleaned.slice(0, -10)} ${cleaned.slice(-10, -7)} ${cleaned.slice(-7, -4)} ${cleaned.slice(-4)}`;
    }
    
    return phone;
  } catch (err) {
    console.error("formatPhoneNumber error:", err);
    return phone;
  }
}

/* ========================================
   TEXT FORMATTING
======================================== */
export function truncateText(text, maxLength = 50, suffix = "...") {
  if (!text) return "";
  if (typeof text !== "string") text = String(text);
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - suffix.length).trim() + suffix;
}

export function truncateMiddle(text, maxLength = 30, separator = "...") {
  if (!text || typeof text !== "string") return "";
  if (text.length <= maxLength) return text;
  
  const charsToShow = maxLength - separator.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);
  
  return text.substring(0, frontChars) + separator + text.substring(text.length - backChars);
}

export function capitalizeFirst(text) {
  if (!text || typeof text !== "string") return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function toTitleCase(text) {
  if (!text || typeof text !== "string") return "";
  
  const smallWords = ["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "with"];
  
  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      if (index === 0 || !smallWords.includes(word)) {
        return capitalizeFirst(word);
      }
      return word;
    })
    .join(" ");
}

export function slugify(text) {
  if (!text || typeof text !== "string") return "";
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function camelToTitle(text) {
  if (!text || typeof text !== "string") return "";
  
  return text
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== "string") return "file";
  
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/^\.+/, "")
    .trim() || "file";
}

/* ========================================
   CHAT & MESSAGE FORMATTING
======================================== */
export function formatLastMessage(message) {
  if (!message) return "";
  
  try {
    if (typeof message === "string") {
      return truncateText(message, 40);
    }
    
    const typeIcons = {
      image: "📷 Image",
      video: "🎥 Video",
      audio: "🎵 Audio",
      file: "📎 File",
      location: "📍 Location",
      poll: "📊 Poll",
      contact: "👤 Contact",
      deleted: "🚫 Message deleted",
      system: "ℹ️ System message",
    };
    
    if (message.type && typeIcons[message.type]) {
      return typeIcons[message.type];
    }
    
    return truncateText(message.content || message.text || "", 40);
  } catch (err) {
    console.error("formatLastMessage error:", err);
    return "";
  }
}

export function formatUsername(username) {
  if (!username || typeof username !== "string") return "Unknown User";
  return username.charAt(0).toUpperCase() + username.slice(1);
}

export function getInitials(name) {
  if (!name || typeof name !== "string") return "?";
  
  try {
    const cleaned = name.trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    
    if (parts.length === 1) {
      return cleaned.substring(0, 2).toUpperCase();
    }
    
    return "?";
  } catch (err) {
    console.error("getInitials error:", err);
    return "?";
  }
}

export function formatMentions(text) {
  if (!text || typeof text !== "string") return text;
  
  // Replace @username with styled mention
  return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
}

export function parseLinks(text) {
  if (!text || typeof text !== "string") return text;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

/* ========================================
   DURATION FORMATTING
======================================== */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds < 0) return "0:00";
  
  try {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  } catch (err) {
    console.error("formatDuration error:", err);
    return "0:00";
  }
}

export function formatCallDuration(seconds) {
  if (!seconds || seconds < 0) return "0s";
  
  try {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(" ");
  } catch (err) {
    console.error("formatCallDuration error:", err);
    return "0s";
  }
}

export function formatTimeRemaining(seconds) {
  if (seconds <= 0) return "Expired";
  
  try {
    const days = Math.floor(seconds / 86400);
    const hrs = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hrs}h`;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    
    return `${Math.floor(seconds)}s`;
  } catch (err) {
    console.error("formatTimeRemaining error:", err);
    return "Unknown";
  }
}

/* ========================================
   COLOR UTILITIES
======================================== */
export function stringToColor(str) {
  if (!str || typeof str !== "string") return "#3b82f6";
  
  try {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Generate pleasant colors (avoid too dark or too light)
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
    const lightness = 45 + (Math.abs(hash) % 10); // 45-55%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } catch (err) {
    console.error("stringToColor error:", err);
    return "#3b82f6";
  }
}

export function generateGradient(str) {
  if (!str || typeof str !== "string") return "linear-gradient(135deg, #3b82f6, #8b5cf6)";
  
  try {
    const color1 = stringToColor(str);
    const color2 = stringToColor(str + "x");
    return `linear-gradient(135deg, ${color1}, ${color2})`;
  } catch (err) {
    console.error("generateGradient error:", err);
    return "linear-gradient(135deg, #3b82f6, #8b5cf6)";
  }
}

export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== "string") return `rgba(59, 130, 246, ${alpha})`;
  
  try {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    
    if (!result) return `rgba(59, 130, 246, ${alpha})`;
    
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  } catch (err) {
    console.error("hexToRgba error:", err);
    return `rgba(59, 130, 246, ${alpha})`;
  }
}

/* ========================================
   FILE UTILITIES
======================================== */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== "string") return "";
  
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

export function getFileNameWithoutExtension(filename) {
  if (!filename || typeof filename !== "string") return "";
  
  const parts = filename.split(".");
  if (parts.length > 1) {
    parts.pop();
  }
  return parts.join(".");
}

export function getFileIcon(filename) {
  const ext = getFileExtension(filename);
  
  const iconMap = {
    // Images
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", svg: "🖼️", webp: "🖼️",
    // Videos
    mp4: "🎥", avi: "🎥", mov: "🎥", wmv: "🎥", flv: "🎥", webm: "🎥",
    // Audio
    mp3: "🎵", wav: "🎵", ogg: "🎵", m4a: "🎵", flac: "🎵",
    // Documents
    pdf: "📄", doc: "📝", docx: "📝", txt: "📃", rtf: "📝",
    // Spreadsheets
    xls: "📊", xlsx: "📊", csv: "📊",
    // Presentations
    ppt: "📊", pptx: "📊",
    // Archives
    zip: "🗜️", rar: "🗜️", "7z": "🗜️", tar: "🗜️", gz: "🗜️",
    // Code
    js: "📜", ts: "📜", jsx: "📜", tsx: "📜", html: "🌐", css: "🎨", json: "📋",
  };
  
  return iconMap[ext] || "📎";
}
