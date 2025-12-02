import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { clearAllSecureChannelXData } from "../hooks/useLocalStorage";
import { clearAllCryptoStores } from "../lib/crypto/store";

export default function Settings() {
  const { user } = useAuth();

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const clearCache = async () => {
    setStatus("");
    setError("");
    try {
      const removedLS = clearAllSecureChannelXData("scx_");
      await clearAllCryptoStores();
      setStatus(`Cleared ${removedLS} local items and crypto stores.`);
    } catch {
      setError("Failed to clear cache.");
    }
  };

  const exportData = () => {
    try {
      const blob = new Blob(
        [JSON.stringify({ user, ts: Date.now() }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scx-settings-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("Exported basic settings.");
    } catch {
      setError("Failed to export settings.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-white px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {status && (
        <div className="mb-4 p-3 bg-green-600/20 border border-green-600/40 rounded text-sm">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-600/20 border border-red-600/40 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4 max-w-xl">
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
          <h2 className="font-semibold mb-2">Cache</h2>
          <p className="text-gray-400 text-sm mb-4">
            Clear local cached data and crypto stores.
          </p>
          <button
            onClick={clearCache}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
          >
            Clear Cache
          </button>
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5">
          <h2 className="font-semibold mb-2">Export</h2>
          <p className="text-gray-400 text-sm mb-4">
            Export basic app settings. Does not include keys.
          </p>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            Export Settings
          </button>
        </div>
      </div>
    </div>
  );
}