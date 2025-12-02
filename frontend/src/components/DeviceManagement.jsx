/**
 * ✅ ENHANCED: SecureChannelX - Device Management Component
 * ---------------------------------------------------------
 * Manage trusted devices and sessions
 * 
 * Changes:
 *   - Fixed: API integration with proper error handling
 *   - Added: Trust/untrust device functionality
 *   - Added: Remove all other devices
 *   - Added: Device type icons
 *   - Added: Last active relative time
 *   - Added: Confirmation dialogs
 *   - Added: Empty state
 *   - Added: Loading states
 *   - Enhanced: Visual design
 *   - Enhanced: Error handling
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import securityApi from "../api/securityApi";
import {
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Trash2,
  Wifi,
  Shield,
  ShieldOff,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

export default function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [trustingId, setTrustingId] = useState(null);
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);

  /**
   * ✅ ENHANCED: Load devices with error handling
   */
  const loadDevices = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await securityApi.getDevices();
      const formatted = (result.devices || []).map((d) =>
        securityApi.formatDeviceInfo(d)
      );
      setDevices(formatted);
    } catch (err) {
      console.error("❌ Error loading devices:", err);
      setError(err.response?.data?.message || "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ ENHANCED: Remove device with confirmation
   */
  const removeDevice = async (deviceId) => {
    if (!confirm("Remove this device? You'll need to log in again on that device.")) {
      return;
    }

    setRemovingId(deviceId);

    try {
      await securityApi.removeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      console.error("❌ Error removing device:", err);
      alert(err.response?.data?.message || "Failed to remove device");
    } finally {
      setRemovingId(null);
    }
  };

  /**
   * ✅ NEW: Trust device
   */
  const trustDevice = async (deviceId) => {
    setTrustingId(deviceId);

    try {
      await securityApi.trustDevice(deviceId);
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, is_trusted: true } : d
        )
      );
    } catch (err) {
      console.error("❌ Error trusting device:", err);
      alert(err.response?.data?.message || "Failed to trust device");
    } finally {
      setTrustingId(null);
    }
  };

  /**
   * ✅ NEW: Untrust device
   */
  const untrustDevice = async (deviceId) => {
    setTrustingId(deviceId);

    try {
      await securityApi.untrustDevice(deviceId);
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, is_trusted: false } : d
        )
      );
    } catch (err) {
      console.error("❌ Error untrusting device:", err);
      alert(err.response?.data?.message || "Failed to untrust device");
    } finally {
      setTrustingId(null);
    }
  };

  /**
   * ✅ NEW: Remove all other devices
   */
  const removeAllOtherDevices = async () => {
    setShowRemoveAllConfirm(false);

    try {
      const result = await securityApi.removeAllOtherDevices();
      alert(`✅ Removed ${result.removed_count} devices`);
      await loadDevices();
    } catch (err) {
      console.error("❌ Error removing all devices:", err);
      alert(err.response?.data?.message || "Failed to remove devices");
    }
  };

  /**
   * ✅ ENHANCED: Format last active time
   */
  const formatLastActive = (timestamp) => {
    if (!timestamp) return "Unknown";

    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return then.toLocaleDateString();
  };

  /**
   * ✅ NEW: Get device type icon
   */
  const getDeviceIcon = (deviceType, os) => {
    if (deviceType === "mobile" || os?.toLowerCase().includes("android") || os?.toLowerCase().includes("ios")) {
      return <Smartphone className="w-10 h-10" />;
    }
    if (deviceType === "tablet") {
      return <Tablet className="w-10 h-10" />;
    }
    return <Monitor className="w-10 h-10" />;
  };

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Your Devices
          </h2>
          <p className="text-gray-400 text-sm">
            These devices have access to your SecureChannelX account
          </p>
        </div>

        {devices.length > 1 && (
          <button
            onClick={() => setShowRemoveAllConfirm(true)}
            className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg text-sm transition border border-red-600/30"
          >
            <Trash2 size={16} />
            Remove All Others
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={loadDevices}
              className="text-red-400 hover:text-red-300 text-sm underline mt-2"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#111827] border border-[#1f2937] h-28 animate-pulse rounded-xl"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && devices.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 bg-gray-800/50 rounded-xl border border-gray-700"
        >
          <Smartphone className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            No devices found
          </h3>
          <p className="text-gray-500 text-sm">
            Your logged-in devices will appear here
          </p>
        </motion.div>
      )}

      {/* Device List */}
      <AnimatePresence>
        {!loading &&
          devices.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 mb-4 hover:border-purple-500/30 transition-all"
            >
              <div className="flex justify-between items-start">
                {/* Device Info */}
                <div className="flex gap-4 flex-1">
                  <div className="text-purple-400">
                    {getDeviceIcon(device.type, device.os)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg text-white">
                        {device.name || "Unknown Device"}
                      </h3>

                      {device.is_current && (
                        <span className="px-2 py-0.5 text-xs rounded-md bg-green-600/20 text-green-400 border border-green-600/30">
                          Current
                        </span>
                      )}

                      {device.is_trusted && (
                        <span className="px-2 py-0.5 text-xs rounded-md bg-blue-600/20 text-blue-400 border border-blue-600/30 flex items-center gap-1">
                          <Shield size={12} />
                          Trusted
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Monitor size={14} />
                        <span>OS: {device.os || "Unknown"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Globe size={14} />
                        <span>Browser: {device.browser || "Unknown"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Wifi size={14} />
                        <span>
                          Last active: {formatLastActive(device.last_active)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {!device.is_current && (
                  <div className="flex flex-col gap-2 ml-4">
                    {/* Trust/Untrust */}
                    <button
                      onClick={() =>
                        device.is_trusted
                          ? untrustDevice(device.id)
                          : trustDevice(device.id)
                      }
                      disabled={trustingId === device.id}
                      className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 px-3 py-1.5 rounded-lg text-sm transition border border-blue-600/30 disabled:opacity-50"
                    >
                      {trustingId === device.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : device.is_trusted ? (
                        <>
                          <ShieldOff size={16} />
                          Untrust
                        </>
                      ) : (
                        <>
                          <Shield size={16} />
                          Trust
                        </>
                      )}
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => removeDevice(device.id)}
                      disabled={removingId === device.id}
                      className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-lg text-sm transition border border-red-600/30 disabled:opacity-50"
                    >
                      {removingId === device.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Remove
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Remove All Confirmation Modal */}
      {showRemoveAllConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-600/20 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Remove All Other Devices?
              </h3>
            </div>

            <p className="text-gray-400 mb-6">
              This will log you out from all devices except this one. You'll
              need to log in again on those devices.
            </p>

            <div className="flex gap-3">
              <button
                onClick={removeAllOtherDevices}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Remove All
              </button>
              <button
                onClick={() => setShowRemoveAllConfirm(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
