import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { notificationsAPI } from '../services/api';
import {
  AlertTriangle, TrendingUp, Target, BarChart3, Info,
  Trash2, CheckCheck, CheckCircle, Bell, FileText,
} from 'lucide-react';

const NotificationCard = React.memo(({ notification, typeConfig, onMarkRead, onDelete, formatDate }) => {
  const cfg = typeConfig[notification.type] || typeConfig['System'];
  return (
    <div
      style={{
        background: notification.isRead ? 'var(--bg-card)' : cfg.bg,
        border: `1px solid ${notification.isRead ? 'var(--border-color)' : cfg.border}`,
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        transition: 'all 0.2s',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontWeight: notification.isRead ? 500 : 700,
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
            }}>
              {notification.title}
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: cfg.color,
              background: cfg.bg,
              padding: '2px 8px',
              borderRadius: '20px',
            }}>
              {cfg.label}
            </span>
            {!notification.isRead && (
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#10b981',
                display: 'inline-block',
                flexShrink: 0,
              }} />
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
            {formatDate(notification.createdAt)}
          </span>
        </div>
        <p style={{
          fontSize: '0.84rem',
          color: 'var(--text-secondary)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          {notification.message}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {!notification.isRead && (
          <button
            onClick={() => onMarkRead(notification._id)}
            title="Mark as read"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#10b981',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(notification._id)}
          title="Dismiss"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
});

const typeConfig = {
  'Budget Alert':      { icon: <AlertTriangle size={16} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)',     border: 'rgba(239,68,68,0.25)',    label: 'Budget' },
  'Investment Update': { icon: <TrendingUp size={16} />,    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',    border: 'rgba(59,130,246,0.25)',   label: 'Investment' },
  'Goal Reminder':     { icon: <Target size={16} />,        color: '#10b981', bg: 'rgba(16,185,129,0.1)',    border: 'rgba(16,185,129,0.25)',   label: 'Goal' },
  'Monthly Summary':   { icon: <BarChart3 size={16} />,     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',    border: 'rgba(139,92,246,0.25)',   label: 'Summary' },
  'System':            { icon: <Info size={16} />,           color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.25)', label: 'System' },
};

const ALL_TYPES = ['All', 'Budget Alert', 'Investment Update', 'Goal Reminder', 'Monthly Summary', 'System'];

const Alerts = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [readFilter, setReadFilter] = useState('All'); // 'All' | 'Unread' | 'Read'
  const [generating, setGenerating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(20);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(20);
  }, [filter, readFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationsAPI.getNotifications();
      if (res.data.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkRead = useCallback(async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {}
  }, []);

  const handleMarkAll = useCallback(async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {}
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await notificationsAPI.deleteNotification(id);
      setNotifications((prev) => {
        const removed = prev.find((n) => n._id === id);
        if (removed && !removed.isRead) setUnreadCount((c) => Math.max(0, c - 1));
        return prev.filter((n) => n._id !== id);
      });
    } catch (err) {}
  }, []);

  const handleGenerateSummary = async () => {
    setGenerating(true);
    try {
      await notificationsAPI.generateSummary();
      await fetchNotifications();
    } catch (err) {}
    setGenerating(false);
  };

  const filtered = notifications.filter((n) => {
    const typeMatch = filter === 'All' || n.type === filter;
    const readMatch = readFilter === 'All' || (readFilter === 'Unread' ? !n.isRead : n.isRead);
    return typeMatch && readMatch;
  });

  const formatDate = useCallback((dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }, []);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Alerts & Notifications" />
        <div className="content-body">

          {/* Controls */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {/* Filter by type */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      background: filter === t ? 'var(--accent-green)' : 'var(--bg-secondary)',
                      color: filter === t ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Read filter + actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={readFilter}
                  onChange={(e) => setReadFilter(e.target.value)}
                  className="form-input"
                  style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem' }}
                >
                  <option value="All">All</option>
                  <option value="Unread">Unread</option>
                  <option value="Read">Read</option>
                </select>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    style={{
                      background: 'rgba(16,185,129,0.15)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      color: '#10b981',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
                <button
                  onClick={handleGenerateSummary}
                  disabled={generating}
                  style={{
                    background: 'rgba(139,92,246,0.15)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    color: '#8b5cf6',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  <FileText size={13} /> {generating ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{notifications.length}</strong> total
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: '#ef4444' }}>{unreadCount}</strong> unread
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> results
            </div>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="empty-state">Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Bell size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No notifications match your filters.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.slice(0, visibleCount).map((n) => (
                  <NotificationCard
                    key={n._id}
                    notification={n}
                    typeConfig={typeConfig}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                    formatDate={formatDate}
                  />
                ))}
              </div>
              {filtered.length > visibleCount && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', paddingBottom: '1rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1.5rem' }}
                    onClick={() => setVisibleCount((prev) => prev + 20)}
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
