// FILE: src/main.jsx or src/index.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { setupGlobalErrorHandlers } from "./utils/errorLogger";

// Global styles
import "./styles/index.css";
import { applySecurityHeaders } from './utils/security';


/* ========================================
   ENVIRONMENT VALIDATION
======================================== */
function validateEnvironment() {
  const requiredVars = [
    "VITE_API_BASE",
    "VITE_SOCKET_URL",
    "VITE_WS_URL",
  ];

  const missing = requiredVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missing.length > 0) {
    console.error(
      "❌ Missing required environment variables:",
      missing.join(", ")
    );
    console.warn(
      "⚠️ Using default values. Check your .env file for production."
    );
  }

  // Log environment info
  console.group("🌍 Environment Configuration");
  console.log("Mode:", import.meta.env.MODE);
  console.log("API Base:", import.meta.env.VITE_API_BASE || "http://localhost:5000");
  console.log("Socket URL:", import.meta.env.VITE_SOCKET_URL || "http://localhost:5050");
  console.log("WebSocket URL:", import.meta.env.VITE_WS_URL || "ws://localhost:5050");
  console.log("App Name:", import.meta.env.VITE_APP_NAME || "SecureChannelX");
  console.log("App Version:", import.meta.env.VITE_APP_VERSION || "1.0.0");
  console.log("Development:", import.meta.env.DEV);
  console.log("Production:", import.meta.env.PROD);
  console.groupEnd();
}

/* ========================================
   BROWSER COMPATIBILITY CHECK
======================================== */
function checkBrowserCompatibility() {
  const requiredFeatures = [
    { name: "WebRTC", check: () => !!window.RTCPeerConnection },
    { name: "WebSocket", check: () => !!window.WebSocket },
    { name: "Web Crypto API", check: () => !!window.crypto?.subtle },
    { name: "MediaDevices API", check: () => !!navigator.mediaDevices },
    { name: "LocalStorage", check: () => !!window.localStorage },
    { name: "SessionStorage", check: () => !!window.sessionStorage },
  ];

  const unsupported = requiredFeatures.filter((feature) => !feature.check());

  if (unsupported.length > 0) {
    console.error(
      "❌ Browser missing required features:",
      unsupported.map((f) => f.name).join(", ")
    );

    // Show error to user
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
        padding: 20px;
      ">
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">⚠️ Browser Not Supported</h1>
        <p style="font-size: 1.1rem; margin-bottom: 2rem; max-width: 500px;">
          Your browser doesn't support the following required features:
        </p>
        <ul style="list-style: none; padding: 0; font-size: 1rem;">
          ${unsupported.map((f) => `<li>❌ ${f.name}</li>`).join("")}
        </ul>
        <p style="margin-top: 2rem; font-size: 0.9rem;">
          Please use a modern browser like Chrome, Firefox, Edge, or Safari.
        </p>
      </div>
    `;
    return false;
  }

  console.log("✅ Browser compatibility check passed");
  return true;
}

/* ========================================
   PERFORMANCE MONITORING
======================================== */
function setupPerformanceMonitoring() {
  if (import.meta.env.DEV) {
    // Log page load time
    const start = performance.now();
    window.addEventListener("load", () => {
      const loadTime = performance.now(); // Use performance.now() instead of Date.now()
      console.log(`⚡ Page loaded in ${loadTime.toFixed(2)}ms`);
    });

    // Monitor React render performance
    if (window.performance?.mark) {
      performance.mark("react-start");
    }
  }
}

/* ========================================
   SERVICE WORKER REGISTRATION (PWA)
======================================== */
async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        "/sw.js"
      );
      console.log("✅ Service Worker registered:", registration.scope);

      // Check for updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("🔄 Service Worker update found");

        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("✅ New Service Worker installed, refresh to update");
          }
        });
      });
    } catch (err) {
      console.error("❌ Service Worker registration failed:", err);
    }
  }
}

/* ========================================
   INITIALIZE APPLICATION
======================================== */
async function initializeApp() {
  try {
    // 1. Validate environment
    validateEnvironment();

    // 2. Check browser compatibility
    if (!checkBrowserCompatibility()) {
      return;
    }

    // 3. Setup global error handlers
    setupGlobalErrorHandlers();

    // 4. Setup performance monitoring
    setupPerformanceMonitoring();

    // 5. Register service worker
    await registerServiceWorker();


    // 7. Apply security headers
    try {
      applySecurityHeaders();
      console.log('✅ Security headers applied');
    } catch (error) {
      console.warn('⚠️ Security headers failed:', error);
    }

    // 6. Render React app
    const root = ReactDOM.createRoot(document.getElementById("root"));

    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    console.log("✅ SecureChannelX initialized successfully");

    // Mark React render complete
    if (import.meta.env.DEV && window.performance?.mark) {
      performance.mark("react-end");
      performance.measure("react-init", "react-start", "react-end");
      const measure = performance.getEntriesByName("react-init")[0];
      console.log(`⚡ React initialized in ${measure.duration.toFixed(2)}ms`);
    }
  } catch (err) {
    console.error("❌ Failed to initialize application:", err);

    // Show error screen
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: system-ui, -apple-system, sans-serif;
        background: #1a1a1a;
        color: white;
        text-align: center;
        padding: 20px;
      ">
        <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #ff4444;">
          🚨 Initialization Error
        </h1>
        <p style="font-size: 1.1rem; margin-bottom: 1rem; color: #ccc;">
          Failed to start the application. Please refresh the page.
        </p>
        <pre style="
          background: #2a2a2a;
          padding: 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          color: #ff6b6b;
          max-width: 600px;
          overflow-x: auto;
        ">${err.message}</pre>
        <button
          onclick="window.location.reload()"
          style="
            margin-top: 2rem;
            padding: 12px 24px;
            font-size: 1rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          "
        >
          🔄 Reload Page
        </button>
      </div>
    `;
  }
}

/* ========================================
   START APPLICATION
======================================== */
initializeApp();
