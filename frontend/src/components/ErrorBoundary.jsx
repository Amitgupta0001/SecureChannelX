// FILE: src/components/ErrorBoundary.jsx

/**
 * SecureChannelX — Error Boundary
 * ------------------------------------------------------------------
 * Catches React render errors and displays a friendly fallback UI.
 * Logs errors using the global errorLogger.
 */

import React from "react";
import { AlertTriangle, RefreshCw, Bug, Home } from "lucide-react";
import { logError } from "../utils/errorLogger.js"; // ✅ fixed — use named function

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      isLogging: false,
    };
  }

  // React transforms UI into fallback state
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Logs detailed error + component stack
  async componentDidCatch(error, errorInfo) {
    console.error("❌ [ErrorBoundary] Caught error:", error);
    console.error("📦 Component Stack:", errorInfo.componentStack);

    this.setState(prev => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
      isLogging: true,
    }));

    // Log error asynchronously
    try {
      logError(error, {
        type: "react",
        category: "render",
        severity: "high",
        componentStack: errorInfo.componentStack,
      });

      console.log("✅ ErrorBoundary logged error");
    } catch (e) {
      console.warn("⚠️ ErrorBoundary failed to log error:", e);
    } finally {
      this.setState({ isLogging: false });
    }
  }

  // Reset boundary and retry
  resetError = () => {
    console.log("🔄 Resetting ErrorBoundary");

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.state.errorCount > 2) {
      console.warn("⚠️ Too many errors, reloading page...");
      window.location.reload();
    }
  };

  // User → Home
  goHome = () => {
    window.location.href = "/";
  };

  // Friendly messages per error type
  getErrorMessage(error) {
    const map = {
      TypeError: "A component used invalid data.",
      ReferenceError: "A missing variable caused a crash.",
      SyntaxError: "There is an application code error.",
      RangeError: "A number exceeded its allowed range.",
      ChunkLoadError: "Failed to load part of the application.",
      NetworkError: "Network request failed.",
    };

    return map[error?.name] || "An unexpected error occurred.";
  }

  // Render fallback UI
  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorCount, isLogging } = this.state;
      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-full">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Something went wrong</h1>
                  <p className="text-red-100 text-sm mt-1">
                    {this.getErrorMessage(error)}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">

              {/* Error details */}
              <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-start gap-3">
                  <Bug className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-300 mb-1">Error Message:</p>
                    <p className="text-sm text-red-400 font-mono break-words">
                      {error?.message}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recurring error note */}
              {errorCount > 1 && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-yellow-400 text-sm">
                  ⚠ This error occurred {errorCount} times.
                  {errorCount > 2 && " Page will auto-reload on next attempt."}
                </div>
              )}

              {/* Logging indicator */}
              {isLogging && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 text-blue-400 text-sm">
                  📤 Sending crash report...
                </div>
              )}

              {/* Dev stack trace */}
              {isDev && error?.stack && (
                <details className="bg-gray-900/50 rounded-lg border border-gray-700">
                  <summary className="p-4 cursor-pointer text-sm text-gray-400 hover:text-gray-300 font-mono">
                    🔍 Stack Trace (Development)
                  </summary>
                  <pre className="p-4 pt-0 text-xs text-gray-400 overflow-x-auto">
                    {error.stack}
                  </pre>
                </details>
              )}

              {/* Component Stack */}
              {isDev && errorInfo?.componentStack && (
                <details className="bg-gray-900/50 rounded-lg border border-gray-700">
                  <summary className="p-4 cursor-pointer text-sm text-gray-400 hover:text-gray-300 font-mono">
                    📦 Component Stack (Development)
                  </summary>
                  <pre className="p-4 pt-0 text-xs text-gray-400 overflow-x-auto">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={this.resetError}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-all"
                >
                  <RefreshCw className="w-5 h-5" /> Try Again
                </button>

                <button
                  onClick={this.goHome}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-all"
                >
                  <Home className="w-5 h-5" /> Go Home
                </button>
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>
                  Need help?{" "}
                  <a
                    href="mailto:support@securechannelx.com"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Contact Support
                  </a>
                </p>
              </div>

            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
