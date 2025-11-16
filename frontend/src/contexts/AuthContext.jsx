import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires_2fa) {
          setRequires2FA(true);
          setPendingUser(data);
          return { requires2FA: true, user: data };
        } else {
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('user_data', JSON.stringify({
            id: data.user_id,
            username: data.username,
            email: data.email
          }));
          setUser({ id: data.user_id, username: data.username, email: data.email });
          return { success: true };
        }
      } else {
        return { error: data.error };
      }
    } catch (error) {
      return { error: 'Network error occurred' };
    }
  };

  const verify2FA = async (userId, otp) => {
    try {
      const response = await fetch('/api/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('user_data', JSON.stringify({
          id: data.user_id,
          username: data.username,
          email: data.email
        }));
        setUser({ id: data.user_id, username: data.username, email: data.email });
        setRequires2FA(false);
        setPendingUser(null);
        return { success: true };
      } else {
        return { error: data.error };
      }
    } catch (error) {
      return { error: 'Network error occurred' };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: data.message };
      } else {
        return { error: data.error };
      }
    } catch (error) {
      return { error: 'Network error occurred' };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      setUser(null);
      setRequires2FA(false);
      setPendingUser(null);
    }
  };

  const value = {
    user,
    loading,
    requires2FA,
    pendingUser,
    login,
    verify2FA,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};