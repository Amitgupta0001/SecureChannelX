import React, { useState, useContext } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, Bell, Lock, Smartphone, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Toggle = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-[#00a884]' : 'bg-[#374045]'
      }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
    />
  </button>
);

const SettingSection = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-[#00a884] font-medium mb-4 uppercase text-xs tracking-wider">{title}</h3>
    <div className="bg-[#202c33] rounded-xl overflow-hidden divide-y divide-[#2a3942]">
      {children}
    </div>
  </div>
);

const SettingItem = ({ icon: Icon, title, description, action }) => (
  <div className="p-4 flex items-center justify-between hover:bg-[#2a3942] transition-colors cursor-pointer" onClick={typeof action === 'function' ? undefined : undefined}>
    <div className="flex items-center gap-4">
      <div className="p-2 bg-[#2a3942] rounded-lg text-[#8696a0]">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[#e9edef] font-medium">{title}</div>
        {description && <div className="text-[#8696a0] text-sm">{description}</div>}
      </div>
    </div>
    <div>
      {action}
    </div>
  </div>
);

export default function Settings() {
  const { user } = useContext(AuthContext);

  // Local state for UI demo (in real app, sync with backend)
  const [privacy, setPrivacy] = useState({
    readReceipts: true,
    lastSeen: true,
    profilePhoto: 'everyone',
    status: 'everyone'
  });

  const [notifications, setNotifications] = useState({
    messages: true,
    groups: true,
    calls: true
  });

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="md:hidden text-[#8696a0]">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </Link>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Profile Card */}
        <Link to="/profile">
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="bg-[#202c33] p-4 rounded-xl flex items-center gap-4 mb-8 cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                  {user?.username?.[0]}
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[#e9edef]">{user?.display_name || user?.username}</h2>
              <p className="text-[#8696a0] text-sm">{user?.status || "Available"}</p>
            </div>
            <ChevronRight className="text-[#8696a0]" />
          </motion.div>
        </Link>

        <SettingSection title="Privacy">
          <SettingItem
            icon={Eye}
            title="Read receipts"
            description="If turned off, you won't send or receive Read receipts."
            action={
              <Toggle
                enabled={privacy.readReceipts}
                onChange={v => setPrivacy({ ...privacy, readReceipts: v })}
              />
            }
          />
          <SettingItem
            icon={Lock}
            title="Last seen"
            description="Controls who can see when you were last active."
            action={
              <select
                className="bg-transparent text-[#00a884] text-sm font-medium outline-none cursor-pointer"
                value={privacy.lastSeen ? 'everyone' : 'nobody'}
                onChange={() => setPrivacy(p => ({ ...p, lastSeen: !p.lastSeen }))}
              >
                <option value="everyone">Everyone</option>
                <option value="contacts">Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            }
          />
          <SettingItem
            icon={Shield}
            title="Blocked contacts"
            description="Manage blocked users"
            action={<ChevronRight className="text-[#8696a0] w-5 h-5" />}
          />
        </SettingSection>

        <SettingSection title="Security">
          <Link to="/devices">
            <SettingItem
              icon={Smartphone}
              title="Linked Devices"
              description="Manage devices logged into your account"
              action={<ChevronRight className="text-[#8696a0] w-5 h-5" />}
            />
          </Link>
          <Link to="/forgot-password">
            <SettingItem
              icon={Lock}
              title="Change Password"
              action={<ChevronRight className="text-[#8696a0] w-5 h-5" />}
            />
          </Link>
          <SettingItem
            icon={Shield}
            title="Two-Step Verification"
            description="Required for extra security"
            action={<div className="text-[#00a884] text-sm font-medium">Enabled</div>}
          />
        </SettingSection>

        <SettingSection title="Notifications">
          <SettingItem
            icon={Bell}
            title="Message Notifications"
            action={
              <Toggle
                enabled={notifications.messages}
                onChange={v => setNotifications({ ...notifications, messages: v })}
              />
            }
          />
        </SettingSection>

        <div className="text-center text-[#8696a0] text-xs mt-8">
          SecureChannelX for Web<br />
          Version 2.4.0 (Late 2025)
        </div>
      </div>
    </div>
  );
}