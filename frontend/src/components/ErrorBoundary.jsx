// FILE: src/components/ErrorBoundary.jsx

import React from "react";
import ErrorFallback from "./ErrorFallback.jsx";   // FIXED: correct extension
import errorLogger from "../utils/errorLogger.js"; // FIXED: explicit extension + correct path

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // React catches render errors here
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // This block is triggered after error is caught
  async componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);

    // Log error to backend (non-blocking)
    try {
      await errorLogger.logError({
        message: error?.message || "Unknown error",
        stack: error?.stack,
        componentStack: info?.componentStack,
      });
    } catch (e) {
      console.warn("Failed to send client error to server:", e);
    }
  }

  // Allow users to retry UI
  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
