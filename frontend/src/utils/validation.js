// FILE: src/utils/validation.js

/* ---------------------------------------------------------
   EMAIL VALIDATION
--------------------------------------------------------- */
export function validateEmail(email) {
  if (!email) return { valid: false, error: "Email is required." };

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!regex.test(email.trim())) {
    return { valid: false, error: "Invalid email format." };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   USERNAME VALIDATION
--------------------------------------------------------- */
export function validateUsername(username) {
  if (!username) return { valid: false, error: "Username is required." };

  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters." };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return {
      valid: false,
      error: "Username can only contain letters, numbers, and underscores.",
    };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   PASSWORD VALIDATION
--------------------------------------------------------- */
export function validatePassword(password) {
  if (!password) return { valid: false, error: "Password is required." };

  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters." };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Include at least 1 uppercase letter." };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Include at least 1 lowercase letter." };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Include at least 1 number." };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   PASSWORD MATCH VALIDATION
--------------------------------------------------------- */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return { valid: false, error: "Passwords do not match." };
  }
  return { valid: true };
}

/* ---------------------------------------------------------
   BIO / PROFILE DESCRIPTION VALIDATION
--------------------------------------------------------- */
export function validateBio(bio) {
  if (!bio) return { valid: true };

  if (bio.length > 200) {
    return { valid: false, error: "Bio cannot exceed 200 characters." };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   MESSAGE VALIDATION
--------------------------------------------------------- */
export function validateMessage(text) {
  if (!text || !text.trim()) {
    return { valid: false, error: "Message cannot be empty." };
  }

  if (text.length > 5000) {
    return { valid: false, error: "Message is too long (max 5000 chars)." };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   FILE UPLOAD VALIDATION
--------------------------------------------------------- */
export function validateFile(file) {
  if (!file) return { valid: false, error: "No file selected." };

  const maxSize = 25 * 1024 * 1024; // 25MB max

  if (file.size > maxSize) {
    return { valid: false, error: "File exceeds 25MB limit." };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   GROUP NAME VALIDATION
--------------------------------------------------------- */
export function validateGroupName(name) {
  if (!name) return { valid: false, error: "Group name required." };

  if (name.length < 3) {
    return { valid: false, error: "Group name must be at least 3 characters." };
  }

  return { valid: true };
}

/* ---------------------------------------------------------
   SEARCH QUERY SANITIZATION
--------------------------------------------------------- */
export function sanitizeQuery(q) {
  if (!q) return "";
  return q.trim().replace(/[<>]/g, ""); // prevent XSS
}
