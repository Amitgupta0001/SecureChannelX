// FILE: src/pages/Devices.jsx
import React, { useEffect, useState, useMemo } from "react";
import securityApi from "../api/securityApi";
import { Smartphone, Trash2, Globe, Wifi, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* -------------------------------------------------------
      Load Devices from Backend with retry + token
  ------------------------------------------------------- */
  const loadDevices = async (retry = false) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await securityApi.getDevices(token);
      const list = Array.isArray(res?.devices) ? res.devices : (Array.isArray(res) ? res : []);
      setDevices(list);
    } catch (err) {
      console.error("Error loading devices:", err);
      setError("Failed to load devices");
      if (!retry) {
        // one retry after 1s
        setTimeout(() => loadDevices(true), 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------
      Remove a Device (Logout remote session) with confirm
  ------------------------------------------------------- */
  const removeDevice = async (deviceId) => {
    if (!deviceId) return;
    const confirmed = window.confirm("Remove this device and end its session?");
    if (!confirmed) return;

    // Optimistic update
    const prev = devices;
    setDevices((d) => d.filter((x) => (x.device_id || x.id) !== deviceId));

    try {
      const token = localStorage.getItem("access_token");
      await securityApi.removeDevice(deviceId, token);
    } catch (err) {
      console.error("Failed to remove device:", err);
      alert("Failed to remove device. Restoring list.");
      setDevices(prev);
    }
  };

  /* -------------------------------------------------------
      Mount: Load Device list
  ------------------------------------------------------- */
  useEffect(() => {
    loadDevices();
  }, []);

  const formatDate = (ts) =>
    ts
      ? new Date(ts).toLocaleString([], {
          hour: "2-digit",
          minute: "2-digit",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Unknown";

  const normalizedDevices = useMemo(
    () =>
      devices.map((d) => ({
        id: d.device_id || d.id,
        name: d.name || d.device_name || "Unknown Device",
        last_active: d.last_active || d.lastSeenAt || d.updated_at,
        browser: d.browser || d.user_agent || "Unknown Browser",
        ip_address: d.ip_address || d.ip || "Unknown IP",
        is_active: !!(d.is_active ?? d.active),
      })),
    [devices]
  );

  return (
    <div className="min-h-screen bg-[#0D1117] text-white p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Devices</h1>
          <p className="text-gray-400">Manage the devices logged into your account.</p>
        </div>
        <button
          onClick={() => loadDevices()}
          className="flex items-center gap-2 px-3 py-2 bg-[#1f2937] border border-[#334155] rounded-lg text-sm hover:bg-[#243041]"
          title="Refresh"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-600/20 border border-red-600/40 text-sm">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 bg-[#111827] border border-[#1f2937] rounded-xl animate-pulse"
            ></div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && normalizedDevices.length === 0 && (
        <div className="text-center text-gray-400 pt-10">
          <Smartphone className="mx-auto mb-4 text-gray-500" size={48} />
          No active devices found.
        </div>
      )}

      {/* DEVICE LIST */}
      <AnimatePresence>
        {!loading &&
          normalizedDevices.map((device) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 mb-4 rounded-xl bg-[#111827] border border-[#1f2937] flex justify-between items-center"
            >
              {/* LEFT SECTION */}
              <div className="flex gap-4">
                <Smartphone size={38} className="text-blue-400" />

                <div>
                  <div className="text-lg font-semibold">{device.name}</div>

                  <div className="text-gray-400 text-sm">
                    Last active: {formatDate(device.last_active)}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Globe size={14} />
                      {device.browser}
                    </span>

                    <span className="flex items-center gap-1">
                      <Wifi size={14} />
                      {device.ip_address}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT SECTION */}
              <div className="flex flex-col items-end">
                {device.is_active && (
                  <span className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-xs mb-2">
                    Active
                  </span>
                )}

                <button
                  onClick={() => removeDevice(device.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 transition rounded-lg text-sm"
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
