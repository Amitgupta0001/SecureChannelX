import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('verifying'); // verifying, valid, invalid, submitting, success, error
  const [message, setMessage] = useState('');

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('Missing reset token.');
      return;
    }

    const verifyToken = async () => {
      try {
        await axios.post('http://localhost:5050/api/auth/verify-reset-token', { token });
        setStatus('valid');
      } catch (err) {
        setStatus('invalid');
        setMessage(err.response?.data?.error || 'Invalid or expired token.');
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters');
      return;
    }

    setStatus('submitting');

    try {
      await axios.post('http://localhost:5050/api/auth/reset-password', {
        token,
        new_password: password
      });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Failed to reset password.');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Invalid Link</h2>
          <p className="text-gray-400 mb-6">{message}</p>
          <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">New Password</h2>
          <p className="text-gray-400">Enter your new secure password</p>
        </div>

        {status === 'success' ? (
          <div className="text-center">
            <div className="bg-green-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Password Reset!</h3>
            <p className="text-gray-400 mb-6">Your password has been successfully updated.</p>
            <Link
              to="/login"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all"
            >
              Login with New Password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-400 mb-2 font-medium">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pl-10 pr-10 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 mb-2 font-medium">Confirm Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 pl-10 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            {(status === 'error' || message) && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {status === 'submitting' ? 'Resetting...' : 'Reset Password'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
