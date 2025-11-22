// FILE: src/pages/Profile.jsx

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Shield, Lock, Smartphone, LogOut } from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");

  const toggleEdit = () => setEditing((prev) => !prev);

  const saveChanges = () => {
    // Future: API endpoint for updating profile
    console.log("Updated Profile:", { username, email });
    setEditing(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#0D1117] text-white px-6 py-10">
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-gray-400">Manage your personal information</p>
      </div>

      {/* PROFILE CARD */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 max-w-xl mx-auto shadow-xl"
      >
        {/* AVATAR */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-3xl font-bold shadow-lg">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </div>

          <button
            onClick={toggleEdit}
            className="mt-4 px-4 py-1 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 transition"
          >
            {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {/* INFO FIELDS */}
        <div className="mt-8 space-y-5">

          {/* Username */}
          <div>
            <label className="text-sm mb-1 flex items-center gap-2">
              <User size={16} /> Username
            </label>
            <input
              type="text"
              className="w-full bg-[#0D1117] border border-[#1f2937] rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={!editing}
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm mb-1 flex items-center gap-2">
              <Mail size={16} /> Email
            </label>
            <input
              type="email"
              className="w-full bg-[#0D1117] border border-[#1f2937] rounded-lg px-4 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!editing}
            />
          </div>
        </div>

        {/* SAVE BUTTON */}
        {editing && (
          <button
            onClick={saveChanges}
            className="w-full mt-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition active:scale-95"
          >
            Save Changes
          </button>
        )}
      </motion.div>

      {/* SECURITY SECTIONS */}
      <div className="max-w-xl mx-auto mt-12 space-y-6">

        {/* Security Center */}
        <Link to="/security" className="block bg-[#111827] border border-[#1f2937] rounded-xl p-5 hover:bg-[#1f2937] transition">
          <div className="flex items-center gap-3">
            <Shield size={22} className="text-blue-400" />
            <div>
              <h3 className="font-semibold text-lg">Security Center</h3>
              <p className="text-gray-400 text-sm">2FA, devices, sessions, audit logs</p>
            </div>
          </div>
        </Link>

        {/* Devices */}
        <Link to="/devices" className="block bg-[#111827] border border-[#1f2937] rounded-xl p-5 hover:bg-[#1f2937] transition">
          <div className="flex items-center gap-3">
            <Smartphone size={22} className="text-green-400" />
            <div>
              <h3 className="font-semibold text-lg">Logged-in Devices</h3>
              <p className="text-gray-400 text-sm">Manage active devices</p>
            </div>
          </div>
        </Link>

        {/* Change Password */}
        <Link to="/change-password" className="block bg-[#111827] border border-[#1f2937] rounded-xl p-5 hover:bg-[#1f2937] transition">
          <div className="flex items-center gap-3">
            <Lock size={22} className="text-red-400" />
            <div>
              <h3 className="font-semibold text-lg">Change Password</h3>
              <p className="text-gray-400 text-sm">Update your login credentials</p>
            </div>
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full py-3 mt-4 bg-red-600 hover:bg-red-700 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <LogOut size={20} /> Log Out
        </button>
      </div>
    </div>
  );
}
