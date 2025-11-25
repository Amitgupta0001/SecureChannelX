// FILE: src/main.jsx or src/index.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Global styles
import "./styles/index.css";
console.log("VITE_API_BASE =", import.meta.env.VITE_API_BASE);
console.log("VITE_SOCKET_URL =", import.meta.env.VITE_SOCKET_URL);
console.log("VITE_WEBSOCKET_URL =", import.meta.env.VITE_WEBSOCKET_URL);


const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
