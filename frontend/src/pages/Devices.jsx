import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, Laptop, Clock, Trash2, Shield, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch devices
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        // Mock data since real endpoint might not be fully implemented or populated
        // In production, GET /api/auth/sessions
        const mockDevices = [
          {
            id: 'current',
            device: 'Chrome on Windows',
            ip: '127.0.0.1',
            last_active: new Date().toISOString(),
            current: true,
            type: 'desktop'
          }
        ];
        setDevices(mockDevices);
      } catch (err) {
        setError('Failed to load devices');
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, []);

  const handleRevoke = (id) => {
    // Implement revoke logic
    setDevices(prev => prev.filter(d => d.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading devices...</div>;

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Shield className="text-[#00a884]" />
          Linked Devices
        </h1>

        <div className="bg-[#202c33] rounded-xl border border-[#2a3942] overflow-hidden">
          <div className="p-4 border-b border-[#2a3942] bg-[#2a3942]/50">
            <p className="text-sm text-[#8696a0]">
              These devices are currently logged into your account.
              Review them regularly for security.
            </p>
          </div>

          <div className="divide-y divide-[#2a3942]">
            {devices.map(device => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 flex items-center justify-between hover:bg-[#2a3942]/30 transition"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${device.current ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    {device.type === 'mobile' ? <Smartphone className="w-6 h-6" /> : <Laptop className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-[#e9edef] flex items-center gap-2">
                      {device.device}
                      {device.current && <span className="bg-[#00a884] text-[#111b21] text-xs px-2 py-0.5 rounded font-bold">This Device</span>}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-[#8696a0] mt-1">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" /> {device.ip}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {device.current ? 'Active now' : new Date(device.last_active).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {!device.current && (
                  <button
                    onClick={() => handleRevoke(device.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    title="Log out device"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>
            If you see a device you don't recognize, remove it immediately
            and change your password.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Devices;
