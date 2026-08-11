import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User } from 'lucide-react';
import NotificationBell from './NotificationBell';

const Header = ({ title }) => {
  const { user } = useAuth();

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-user" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <NotificationBell />
        <div className="user-badge">
          <User size={16} />
          <span>{user?.name || 'User'}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
