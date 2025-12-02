// FILE: src/utils/validation.js

import { REGEX, FILE_LIMITS } from "./constants";

/**
 * Validation utilities for SecureChannelX
 * @module utils/validation
 */

/* ========================================
   EMAIL VALIDATION
======================================== */
export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return REGEX.EMAIL.test(email.trim());
}

/* ========================================
   USERNAME VALIDATION
======================================== */
export function isValidUsername(username) {
  if (!username || typeof username !== "string") return false;
  return REGEX.USERNAME.test(username.trim());
}

/* ========================================
   PASSWORD STRENGTH
======================================== */
export function getPasswordStrength(password) {
  if (!password) return { score: 0, feedback: "Password is required" };

  let score = 0;
  const feedback = [];

  if (password.length >= 8) score++;
  else feedback.push("At least 8 characters");

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password)) score++;
  else feedback.push("Include lowercase letters");

  if (/[A-Z]/.test(password)) score++;
  else feedback.push("Include uppercase letters");

  if (/[0-9]/.test(password)) score++;
  else feedback.push("Include numbers");

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push("Include special characters");

  const strength = ["Weak", "Fair", "Good", "Strong", "Very Strong"][
    Math.min(score - 1, 4)
  ];

  return { score, strength, feedback };
}

export function isStrongPassword(password) {
  const { score } = getPasswordStrength(password);
  return score >= 4;
}

/* ========================================
   PHONE NUMBER VALIDATION
======================================== */
export function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== "string") return false;
  return REGEX.PHONE.test(phone.trim());
}

/* ========================================
   URL VALIDATION
======================================== */
export function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  return REGEX.URL.test(url.trim());
}

/* ========================================
   FILE VALIDATION
======================================== */
export function validateFile(file, options = {}) {
  const {
    maxSize = FILE_LIMITS.MAX_SIZE,
    allowedTypes = [],
  } = options;

  if (!file || !(file instanceof File)) {
    return { valid: false, error: "Invalid file" };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large. Max size: ${formatFileSize(maxSize)}`,
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

export function validateImage(file) {
  return validateFile(file, {
    maxSize: FILE_LIMITS.MAX_SIZE_IMAGE,
    allowedTypes: FILE_LIMITS.ALLOWED_IMAGE_TYPES,
  });
}

export function validateVideo(file) {
  return validateFile(file, {
    maxSize: FILE_LIMITS.MAX_SIZE_VIDEO,
    allowedTypes: FILE_LIMITS.ALLOWED_VIDEO_TYPES,
  });
}

/* ========================================
   INPUT SANITIZATION
======================================== */
export function sanitizeInput(input) {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .replace(/[<>]/g, "")
    .substring(0, 10000);
}

export function sanitizeHtml(html) {
  const temp = document.createElement("div");
  temp.textContent = html;
  return temp.innerHTML;
}

/* ========================================
   FORM VALIDATION
======================================== */
export function validateLoginForm(username, password) {
  const errors = {};

  if (!username || !username.trim()) {
    errors.username = "Username is required";
  }

  if (!password || password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateRegisterForm(username, email, password, confirmPassword) {
  const errors = {};

  if (!isValidUsername(username)) {
    errors.username = "Username must be 3-20 characters (letters, numbers, underscore)";
  }

  if (!isValidEmail(email)) {
    errors.email = "Invalid email address";
  }

  const passwordCheck = getPasswordStrength(password);
  if (passwordCheck.score < 3) {
    errors.password = passwordCheck.feedback.join(", ");
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/* ========================================
   HELPER
======================================== */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
