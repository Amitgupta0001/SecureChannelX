// FILE: src/components/SecurityDashboard.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth } from "../context/AuthContext";
import securityApi from "../api/securityApi";

import TwoFactorSetup from "./TwoFactorSetup";

// Icons
import {
  Shield,
  Smartphone,
  Activity,
  KeyRound,
  Lock,
  Trash2,
} from "lucide-react";

export default function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const [auditLogs, setAuditLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [sessionKeys, setSessionKeys] = useState([]);

  const [loading, setLoading] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (activeTab === "audit") loadAuditLogs();
    if (activeTab === "devices") loadDevices();
    if (activeTab === "sessions") loadSessions();
  }, [activeTab]);

  /** LOAD DATA FUNCTIONS */
  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getAuditLogs();
      setAuditLogs(res.audit_logs || []);
    } catch (err) {
      console.error("Audit log load error:", err);
    }
    setLoading(false);
  };

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getDevices();
      setDevices(res.devices || []);
    } catch (err) {
      console.error("Device load error:", err);
    }
    setLoading(false);
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await securityApi.getSessionKeys();
      setSessionKeys(res.session_keys || []);
    } catch (err) {
      console.error("Session load error:", err);
    }
    setLoading(false);
  };

  const removeDevice = async (deviceId) => {
    try {
      await securityApi.removeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      console.error("Remove device failed:", err);
    }
  };

  const formatDate = (ts) =>
    new Date(ts).toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    });

  return (
    <div className="min-h-screen bg-[#0D1117] text-white px-4 py-6">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Security Center</h1>
          <p className="text-gray-400">
            Manage account protection, privacy, and device security.
          </p>
        </div>

        {/* TABS */}
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {[
            ["overview", "🔒 Overview"],
            ["2fa", "🛡 Two-Factor Auth"],
            ["devices", "📱 Devices"],
            ["audit", "📊 Audit Logs"],
            ["sessions", "🔑 Sessions"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-xl border transition ${
                activeTab === key
                  ? "bg-blue-600 border-blue-500"
                  : "bg-[#111827] border-[#1f2937] hover:bg-[#1a2333]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="mt-4">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Status Grid */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-[#111827] border border-[#1f2937] p-5 rounded-xl flex gap-4">
                  <Lock className="text-blue-400 w-8 h-8" />
                  <div>
                    <h4 className="font-semibold">Account Protection</h4>
                    <p className="text-gray-400 text-sm">Your account is active.</p>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1f2937] p-5 rounded-xl flex gap-4">
                  <Shield className="text-green-400 w-8 h-8" />
                  <div>
                    <h4 className="font-semibold">Two-Factor Authentication</h4>
                    <p className="text-gray-400 text-sm">
                      {user?.two_factor_enabled ? "Enabled" : "Not enabled"}
                    </p>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1f2937] p-5 rounded-xl flex gap-4">
                  <Smartphone className="text-purple-400 w-8 h-8" />
                  <div>
                    <h4 className="font-semibold">Active Devices</h4>
                    <p className="text-gray-400 text-sm">{devices.length} device(s)</p>
                  </div>
                </div>

                <div className="bg-[#111827] border border-[#1f2937] p-5 rounded-xl flex gap-4">
                  <KeyRound className="text-yellow-400 w-8 h-8" />
                  <div>
                    <h4 className="font-semibold">Encryption Level</h4>
                    <p className="text-gray-400 text-sm">End-to-End Secure</p>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-[#111827] border border-[#1f2937] p-5 rounded-xl">
                <h3 className="font-semibold text-lg mb-3">Security Tips</h3>
                <ul className="space-y-2 text-gray-300">
                  <li>✓ Enable two-factor authentication</li>
                  <li>✓ Use a strong unique password</li>
                  <li>✓ Check active devices frequently</li>
                  <li>✓ Monitor login and activity logs</li>
                </ul>
              </div>
            </motion.div>
          )}

          {/* 2FA TAB */}
          {activeTab === "2fa" && <TwoFactorSetup />}

          {/* DEVICES TAB */}
          {activeTab === "devices" && (
            <div>
              <h3 className="text-xl font-semibold mb-2">Your Devices</h3>
              <p className="text-gray-400 mb-4">
                Devices that have logged into your account.
              </p>

              {devices.length === 0 ? (
                <p className="text-gray-500">No devices found.</p>
              ) : (
                <div className="space-y-4">
                  {devices.map((device) => (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#111827] p-4 border border-[#1f2937] rounded-xl flex justify-between items-center"
                    >
                      <div className="flex gap-3">
                        <Smartphone className="w-8 h-8 text-purple-400" />
                        <div>
                          <div className="font-semibold">{device.device_name}</div>
                          <div className="text-gray-400 text-sm">
                            Last active: {formatDate(device.last_active)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeDevice(device.id)}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg text-sm"
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === "audit" && (
            <div>
              <h3 className="text-xl font-semibold mb-3">Audit Logs</h3>

              {auditLogs.length === 0 ? (
                <p className="text-gray-400">No logs yet.</p>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#111827] p-4 border border-[#1f2937] rounded-xl"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{log.action}</span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(log.created_at)}
                        </span>
                      </div>

                      <div className="text-gray-400 text-sm mt-1">
                        IP: {log.ip_address}
                      </div>

                      {log.details && (
                        <div className="text-gray-500 text-xs mt-1">
                          {log.details}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SESSIONS TAB */}
          {activeTab === "sessions" && (
            <div>
              <h3 className="text-xl font-semibold mb-3">
                Recent Encryption Session Keys
              </h3>

              {sessionKeys.length === 0 ? (
                <p className="text-gray-500">No session keys generated yet.</p>
              ) : (
                <div className="space-y-3">
                  {sessionKeys.map((key) => (
                    <motion.div
                      key={key.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#111827] border border-[#1f2937] p-4 rounded-xl flex justify-between"
                    >
                      <div>
                        <div className="text-gray-300 max-w-xs truncate">
                          {key.session_key}
                        </div>
                        <div className="text-gray-500 text-xs">
                          Created: {formatDate(key.created_at)}
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-lg text-xs ${
                          key.is_active
                            ? "bg-green-600/30 text-green-400"
                            : "bg-red-600/30 text-red-400"
                        }`}
                      >
                        {key.is_active ? "Active" : "Expired"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
