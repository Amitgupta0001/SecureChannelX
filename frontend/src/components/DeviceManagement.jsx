// FILE: src/components/DeviceManagement.jsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import securityApi from "../api/securityApi";

import { Smartphone, Globe, Trash2, Wifi } from "lucide-react";

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const removeDevice = async (id) => {
    try {
      await securityApi.removeDevice(id);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Error removing device:", err);
    }
  };

  const formatDate = (ts) =>
    new Date(ts).toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-2">Your Devices</h2>
      <p className="text-gray-400 mb-6">
        These devices have access to your SecureChannelX account.
      </p>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#111827] border border-[#1f2937] h-20 animate-pulse rounded-xl"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && devices.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-10 text-gray-400"
        >
          <Smartphone className="w-10 h-10 mx-auto mb-2 text-gray-500" />
          No devices found.
        </motion.div>
      )}

      {/* Device List */}
      <AnimatePresence>
        {!loading &&
          devices.map((device) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 mb-4 flex justify-between items-center"
            >
              {/* Device Info */}
              <div className="flex gap-4">
                <Smartphone className="text-purple-400 w-10 h-10" />

                <div>
                  <div className="font-semibold text-lg">
                    {device.device_name || "Unknown Device"}
                  </div>

                  <div className="text-gray-400 text-sm">
                    OS: {device.os || "Unknown"}
                  </div>

                  <div className="text-gray-400 text-sm">
                    Last active: {formatDate(device.last_active)}
                  </div>

                  <div className="flex gap-4 text-gray-500 text-xs mt-1">
                    <span className="flex items-center gap-1">
                      <Globe size={14} /> {device.browser || "Browser?"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wifi size={14} /> {device.ip_address || "Unknown IP"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end">
                {device.is_active && (
                  <span className="px-3 py-1 text-xs rounded-lg bg-green-600/20 text-green-400 mb-2">
                    Active
                  </span>
                )}

                <button
                  onClick={() => removeDevice(device.id)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg text-sm transition"
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
