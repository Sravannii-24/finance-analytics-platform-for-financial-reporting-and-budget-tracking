import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CreditCard,
  PieChart,
  User,
  LogOut,
  TrendingUp,
  Target,
  BarChart3,
  Bell,
  FileText,
  Users,
  Shield,
} from 'lucide-react';

const Sidebar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard',   icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Expenses',    icon: <CreditCard size={20} />,      path: '/expenses' },
    { name: 'Budgets',     icon: <PieChart size={20} />,        path: '/budgets' },
    { name: 'Investments', icon: <TrendingUp size={20} />,      path: '/investments' },
    { name: 'Goals',       icon: <Target size={20} />,          path: '/goals' },
    { name: 'Analytics',   icon: <BarChart3 size={20} />,       path: '/analytics' },
    { name: 'Alerts',      icon: <Bell size={20} />,            path: '/alerts' },
    { name: 'Reports',     icon: <FileText size={20} />,        path: '/reports' },
    { name: 'Profile',     icon: <User size={20} />,            path: '/profile' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <TrendingUp size={24} style={{ stroke: 'url(#logo-grad)' }} />
          <span>FinSight</span>
        </div>
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </svg>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <div
              key={item.name}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.name}</span>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-item" onClick={handleLogout} style={{ color: '#ef4444' }}>
          <LogOut size={20} />
          <span>Logout</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
