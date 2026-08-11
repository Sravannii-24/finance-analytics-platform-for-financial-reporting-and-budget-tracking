import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user details
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    if (response.data && response.data.success) {
      const userData = response.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(response.data.message || 'Login failed');
  };

  const register = async (name, email, password, confirmPassword) => {
    const response = await authAPI.register({ name, email, password, confirmPassword });
    if (response.data && response.data.success) {
      const userData = response.data;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    }
    throw new Error(response.data.message || 'Registration failed');
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.data && response.data.success) {
        const updatedProfile = response.data.data;
        setUser((prev) => {
          const updated = { ...prev, ...updatedProfile };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const updateProfileData = async (name, email, monthlyIncome) => {
    const response = await authAPI.updateProfile({ name, email, monthlyIncome });
    if (response.data && response.data.success) {
      const updatedProfile = response.data.data;
      setUser((prev) => {
        const updated = { ...prev, ...updatedProfile };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
      return response.data.data;
    }
    throw new Error(response.data.message || 'Update failed');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
