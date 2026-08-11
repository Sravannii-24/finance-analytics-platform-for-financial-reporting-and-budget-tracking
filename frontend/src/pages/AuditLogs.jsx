import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { auditAPI } from '../services/api';
import { Shield, Clock, Info } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.getLogs();
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch security logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Security Audit Logs" />
        <div className="content-body">
          <div className="card mb-md">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Shield size={24} style={{ color: '#10b981' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Security & Audit Log</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  A complete log of security, authentication, and transaction changes in your account.
                </p>
              </div>
            </div>
          </div>

          {error && <div className="alert-box alert-box-error">{error}</div>}

          <div className="card">
            {loading ? (
              <div className="empty-state">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <p style={{ color: 'var(--text-muted)' }}>No logs found for this account.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Category</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const date = new Date(log.timestamp).toLocaleString('en-IN');
                      return (
                        <tr key={log._id}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{date}</td>
                          <td>
                            <span 
                              className="category-tag" 
                              style={{ 
                                backgroundColor: 'rgba(255,255,255,0.06)', 
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                border: '1px solid var(--border-color)'
                              }}
                            >
                              {log.category}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.action}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {log.details && typeof log.details === 'object' ? (
                              <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(log.details)}
                              </pre>
                            ) : (
                              log.details || 'None'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
