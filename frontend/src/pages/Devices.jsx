// FILE: src/pages/Devices.jsx
import React, { useEffect, useState } from "react";
import securityApi from "../api/securityApi";
import { Smartphone, Trash2, Globe, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  /* -------------------------------------------------------
      Load Devices from Backend
  ------------------------------------------------------- */
  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getDevices();
      setDevices(res.devices || []);
    } catch (err) {
      console.error("Error loading devices:", err);
    }
    setLoading(false);
  };

  /* -------------------------------------------------------
      Remove a Device (Logout remote session)
  ------------------------------------------------------- */
  const removeDevice = async (deviceId) => {
    try {
      await securityApi.removeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      console.error("Failed to remove device:", err);
    }
  };

  /* -------------------------------------------------------
      Mount: Load Device list
  ------------------------------------------------------- */
  useEffect(() => {
    loadDevices();
  }, []);

  const formatDate = (ts) =>
    new Date(ts).toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-[#0D1117] text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Your Devices</h1>
        <p className="text-gray-400">Manage the devices logged into your account.</p>
      </div>

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
      {!loading && devices.length === 0 && (
        <div className="text-center text-gray-400 pt-10">
          <Smartphone className="mx-auto mb-4 text-gray-500" size={48} />
          No active devices found.
        </div>
      )}

      {/* DEVICE LIST */}
      <AnimatePresence>
        {!loading &&
          devices.map((device) => (
            <motion.div
              key={device.device_id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 mb-4 rounded-xl bg-[#111827] border border-[#1f2937] flex justify-between items-center"
            >
              {/* LEFT SECTION */}
              <div className="flex gap-4">
                <Smartphone size={38} className="text-blue-400" />

                <div>
                  <div className="text-lg font-semibold">
                    {device.name || "Unknown Device"}
                  </div>

                  <div className="text-gray-400 text-sm">
                    Last active: {formatDate(device.last_active)}
                  </div>

                  <div className="flex gap-4 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Globe size={14} />
                      {device.browser || "Unknown Browser"}
                    </span>

                    <span className="flex items-center gap-1">
                      <Wifi size={14} />
                      {device.ip_address || "Unknown IP"}
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
                  onClick={() => removeDevice(device.device_id)}
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
