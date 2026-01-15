import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { Camera, User, Mail, Lock, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Profile() {
  const { user, token, setUser } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    display_name: user?.display_name || '',
    status: user?.status || 'Available',
    phone_number: user?.phone_number || ''
  });

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        status: user.status || 'Available',
        phone_number: user.phone_number || ''
      });
      setAvatarPreview(user.avatar);
    }
  }, [user]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image too large (max 5MB)' });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);

    // Upload immediately
    const data = new FormData();
    data.append('avatar', file);

    setLoading(true);
    try {
      const res = await axios.put('http://localhost:5050/api/users/profile/avatar', data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update local user context
      setUser({ ...user, avatar: res.data.avatar });
      setMessage({ type: 'success', text: 'Avatar updated!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to upload avatar' });
      // Revert preview
      setAvatarPreview(user?.avatar);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Assume endpoint exists -> Update /api/users/profile
      // If not, we might need to create it, but usually basic profile update is standard.
      // Let's use the standard update endpoint
      const res = await axios.put('http://localhost:5050/api/users/profile', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUser({ ...user, ...res.data.user });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#202c33] rounded-2xl p-6 md:p-10 shadow-xl border border-[#2a3942]"
        >
          <h1 className="text-2xl font-bold mb-8 flex items-center gap-3">
            <User className="text-[#00a884]" />
            Profile Settings
          </h1>

          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative group cursor-pointer">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#00a884] bg-gray-700">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-400">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>

              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleAvatarChange}
              />
            </div>
            <p className="mt-3 text-[#8696a0] text-sm">Click to change profile photo</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[#8696a0] text-sm font-medium mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full bg-[#2a3942] border border-[#2a3942] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00a884] transition-colors"
                  placeholder="Your Name"
                />
              </div>
              <div>
                <label className="block text-[#8696a0] text-sm font-medium mb-2">Status</label>
                <input
                  type="text"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-[#2a3942] border border-[#2a3942] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00a884] transition-colors"
                  placeholder="Available"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#8696a0] text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full bg-[#2a3942] border border-[#2a3942] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00a884] transition-colors"
                placeholder="+1 234 567 8900"
              />
            </div>

            {/* Read-only fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
              <div>
                <label className="block text-[#8696a0] text-sm font-medium mb-2">Username</label>
                <div className="w-full bg-[#2a3942]/50 border border-[#2a3942] rounded-lg px-4 py-3 text-gray-400 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {user.username}
                </div>
              </div>
              <div>
                <label className="block text-[#8696a0] text-sm font-medium mb-2">Email</label>
                <div className="w-full bg-[#2a3942]/50 border border-[#2a3942] rounded-lg px-4 py-3 text-gray-400 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </div>
              </div>
            </div>

            {/* Status Message */}
            {message && (
              <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {message.text}
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="mr-4 px-6 py-3 text-[#8696a0] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Changes
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
