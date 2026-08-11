import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { householdAPI, auditAPI } from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import {
  User,
  Users,
  Shield,
  Link2,
  Copy,
  Trash2,
  LogOut,
  PlusCircle,
  Clock,
  ShieldAlert,
  ArrowRight,
  Plus,
  Edit2,
  ListFilter
} from 'lucide-react';

const Profile = () => {
  const { user, updateProfileData, refreshProfile } = useAuth();

  // Navigation state
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'household' | 'activity'

  // Settings tab states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Household tab states
  const [household, setHousehold] = useState(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [householdError, setHouseholdError] = useState('');
  const [householdSuccess, setHouseholdSuccess] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  // Activity history states
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [selectedResourceType, setSelectedResourceType] = useState('');
  const [logsLimit, setLogsLimit] = useState(50);
  const [logsPage, setLogsPage] = useState(1);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  // Load initial settings
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setMonthlyIncome(user.monthlyIncome !== undefined ? user.monthlyIncome : '');
    }
  }, [user]);

  // Load household on tab change or user update
  useEffect(() => {
    if (activeTab === 'household' && user?.household) {
      fetchHouseholdDetails();
    }
  }, [activeTab, user?.household]);

  // Load activity logs on tab change or filter update
  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLogs(true);
    }
  }, [activeTab, selectedResourceType, logsLimit]);

  // ─── Settings Logic ────────────────────────────────────────────────
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError(''); setSettingsSuccess('');
    if (!name || !email) return setSettingsError('Name and Email are required');
    if (Number(monthlyIncome) < 0) return setSettingsError('Monthly income cannot be negative');

    setSettingsLoading(true);
    try {
      await updateProfileData(name, email, Number(monthlyIncome));
      setSettingsSuccess('Profile settings saved successfully!');
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      setSettingsError(err.response?.data?.message || err.message || 'Error updating profile');
    } finally { setSettingsLoading(false); }
  };

  // ─── Household Logic ───────────────────────────────────────────────
  const fetchHouseholdDetails = async () => {
    setHouseholdLoading(true);
    setHouseholdError('');
    try {
      const res = await householdAPI.getHousehold();
      if (res.data.success) {
        setHousehold(res.data.data);
      }
    } catch (err) {
      setHouseholdError('Failed to load household details.');
    } finally {
      setHouseholdLoading(false);
    }
  };

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    setHouseholdError(''); setHouseholdSuccess('');
    if (!newHouseholdName.trim()) return setHouseholdError('Enter a household name');

    try {
      const res = await householdAPI.createHousehold({ name: newHouseholdName });
      if (res.data.success) {
        setHouseholdSuccess('Household space created!');
        setNewHouseholdName('');
        await refreshProfile();
        fetchHouseholdDetails();
      }
    } catch (err) {
      setHouseholdError(err.response?.data?.message || 'Failed to create household');
    }
  };

  const handleJoinHousehold = async (e) => {
    e.preventDefault();
    setHouseholdError(''); setHouseholdSuccess('');
    if (!inviteCodeInput.trim()) return setHouseholdError('Enter a valid 6-char invite code');

    try {
      const res = await householdAPI.joinHousehold({ inviteCode: inviteCodeInput.trim().toUpperCase() });
      if (res.data.success) {
        setHouseholdSuccess('Successfully joined household!');
        setInviteCodeInput('');
        await refreshProfile();
        fetchHouseholdDetails();
      }
    } catch (err) {
      setHouseholdError(err.response?.data?.message || 'Failed to join household. Double-check code.');
    }
  };

  const handleLeaveHousehold = async () => {
    if (!household) return;
    const isOwner = household.owner?._id === user?._id;
    const confirmMessage = isOwner 
      ? 'Dissolving the household will detach all family members and remove sharing. Continue?'
      : 'Are you sure you want to leave the household?';

    if (!window.confirm(confirmMessage)) return;

    setHouseholdError(''); setHouseholdSuccess('');
    try {
      const res = await householdAPI.leaveHousehold(household._id);
      if (res.data.success) {
        setHouseholdSuccess(res.data.message || 'Left household successfully');
        setHousehold(null);
        await refreshProfile();
      }
    } catch (err) {
      setHouseholdError('Failed to perform action.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!household) return;
    if (!window.confirm('Remove this member from the household?')) return;

    setHouseholdError(''); setHouseholdSuccess('');
    try {
      const res = await householdAPI.removeMember(household._id, memberId);
      if (res.data.success) {
        setHouseholdSuccess('Member removed successfully');
        fetchHouseholdDetails();
      }
    } catch (err) {
      setHouseholdError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const copyInviteCode = () => {
    if (!household?.inviteCode) return;
    navigator.clipboard.writeText(household.inviteCode);
    alert('Household Invite Code copied to clipboard!');
  };

  // ─── Activity History Logic ────────────────────────────────────────
  const fetchActivityLogs = async (reset = false) => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const pageToFetch = reset ? 1 : logsPage + 1;
      const res = await auditAPI.getLogs(selectedResourceType, logsLimit);
      if (res.data.success) {
        const fetchedLogs = res.data.data;
        if (reset) {
          setLogs(fetchedLogs);
          setLogsPage(1);
        } else {
          setLogs((prev) => [...prev, ...fetchedLogs]);
          setLogsPage(pageToFetch);
        }
        setHasMoreLogs(fetchedLogs.length === logsLimit);
      }
    } catch (err) {
      setLogsError('Failed to fetch activity history.');
    } finally {
      setLogsLoading(false);
    }
  };

  // Human-readable audit log description builder
  const formatAuditDiff = (log) => {
    const { action, resourceType, previousValue, newValue } = log;
    const prev = previousValue || {};
    const curr = newValue || {};

    const formatVal = (val) => formatCurrency(val);

    switch (resourceType) {
      case 'Budget':
        if (action === 'CREATE') {
          return `Created Budget for ${curr.category}: ${formatVal(curr.amount)}`;
        }
        if (action === 'DELETE') {
          return `Deleted Budget for ${prev.category}: ${formatVal(prev.amount)}`;
        }
        return `Budget for ${curr.category} changed from ${formatVal(prev.amount)} to ${formatVal(curr.amount)}`;

      case 'Expense':
        if (action === 'CREATE') {
          return `Created Expense: ${curr.category} - ${formatVal(curr.amount)}`;
        }
        if (action === 'DELETE') {
          return `Deleted Expense: ${prev.category} - ${formatVal(prev.amount)}`;
        }
        if (prev.amount !== curr.amount && prev.category !== curr.category) {
          return `Expense changed: ${prev.category} (${formatVal(prev.amount)}) to ${curr.category} (${formatVal(curr.amount)})`;
        }
        if (prev.amount !== curr.amount) {
          return `Expense amount for ${curr.category} changed from ${formatVal(prev.amount)} to ${formatVal(curr.amount)}`;
        }
        return `Expense category changed from ${prev.category} to ${curr.category} (${formatVal(curr.amount)})`;

      case 'Goal':
        if (action === 'CREATE') {
          return `Created Goal "${curr.goalName}": Target ${formatVal(curr.targetAmount)}`;
        }
        if (action === 'DELETE') {
          return `Deleted Goal "${prev.goalName}"`;
        }
        if (curr.currentAmount > prev.currentAmount) {
          return `Added contribution of ${formatVal(curr.currentAmount - prev.currentAmount)} to Goal "${curr.goalName}"`;
        }
        return `Goal "${curr.goalName}" updated (Target: ${formatVal(curr.targetAmount)})`;

      case 'Investment':
        if (action === 'CREATE') {
          return `Added Investment "${curr.assetName}": ${curr.quantity} units at ${formatVal(curr.purchasePrice)}`;
        }
        if (action === 'DELETE') {
          return `Removed Investment "${prev.assetName}"`;
        }
        if (prev.currentPrice !== curr.currentPrice) {
          return `Investment "${curr.assetName}" price refreshed to ${formatVal(curr.currentPrice)}`;
        }
        return `Investment "${curr.assetName}" updated`;

      case 'RecurringExpense':
        if (action === 'CREATE') {
          return `Created Recurring Expense for ${curr.category}: ${formatVal(curr.amount)} (${curr.frequency})`;
        }
        if (action === 'DELETE') {
          return `Deleted Recurring Expense for ${prev.category}`;
        }
        if (prev.isActive !== curr.isActive) {
          return `Recurring Expense for ${curr.category} ${curr.isActive ? 'activated' : 'paused'}`;
        }
        return `Recurring Expense for ${curr.category} changed from ${formatVal(prev.amount)} to ${formatVal(curr.amount)}`;

      default:
        return `${action} action on ${resourceType}`;
    }
  };

  const getLogIcon = (action) => {
    switch (action) {
      case 'CREATE':
        return <div className="metric-icon icon-green"><Plus size={16} /></div>;
      case 'UPDATE':
        return <div className="metric-icon icon-blue"><Edit2 size={16} /></div>;
      case 'DELETE':
        return <div className="metric-icon icon-red"><Trash2 size={16} /></div>;
      default:
        return <div className="metric-icon"><Clock size={16} /></div>;
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Account Settings" />
        <div className="content-body">
          
          {/* Glassmorphic Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('settings')}
              className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <User size={16} />
              Profile Settings
            </button>
            <button
              onClick={() => setActiveTab('household')}
              className={`btn ${activeTab === 'household' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <Users size={16} />
              Household Space
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`btn ${activeTab === 'activity' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              <Shield size={16} />
              Activity History
            </button>
          </div>

          {/* Tab Content Rendering */}
          {activeTab === 'settings' && (
            <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <h2 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} style={{ color: 'var(--accent-green)' }} />
                Profile Information
              </h2>
              {settingsError && <div className="alert-box alert-box-error">{settingsError}</div>}
              {settingsSuccess && <div className="alert-box alert-box-success">{settingsSuccess}</div>}
              
              <form onSubmit={handleSaveSettings}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Income (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="e.g. 50000"
                    min="0"
                  />
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                    Used to calculate your savings and budget utilization across the dashboard.
                  </small>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={settingsLoading}>
                  {settingsLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'household' && (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              {householdError && <div className="alert-box alert-box-error">{householdError}</div>}
              {householdSuccess && <div className="alert-box alert-box-success">{householdSuccess}</div>}

              {householdLoading ? (
                <div className="card empty-state">Loading household status...</div>
              ) : household ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '1.5rem' }}>
                  
                  {/* Left Column: Members list */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <Users size={22} style={{ color: 'var(--accent-green)' }} />
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                        {household.name} Members
                      </h3>
                    </div>
                    
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            {household.owner?._id === user?._id && <th style={{ textAlign: 'right' }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {household.members.map((m) => {
                            const isMe = m.user?._id === user?._id;
                            const isOwner = m.role === 'Owner';
                            return (
                              <tr key={m.user?._id}>
                                <td style={{ fontWeight: 600 }}>
                                  {m.user?.name} {isMe && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
                                </td>
                                <td>{m.user?.email}</td>
                                <td>
                                  <span
                                    className="category-tag"
                                    style={{
                                      backgroundColor: isOwner ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                                      color: isOwner ? 'var(--accent-green)' : 'var(--text-secondary)'
                                    }}
                                  >
                                    {m.role}
                                  </span>
                                </td>
                                {household.owner?._id === user?._id && (
                                  <td style={{ textAlign: 'right' }}>
                                    {!isMe && (
                                      <button
                                        onClick={() => handleRemoveMember(m.user?._id)}
                                        className="icon-btn icon-btn-danger"
                                        title="Remove Member"
                                        style={{ padding: '0.2rem' }}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Column: Invite details / admin controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Invite Code</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 850, letterSpacing: '0.05em', color: 'var(--accent-green)' }}>
                          {household.inviteCode}
                        </span>
                        <button
                          className="icon-btn"
                          onClick={copyInviteCode}
                          title="Copy Code"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <p style={{ margin: '8px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Share code with family members to join this workspace.
                      </p>
                    </div>

                    <div className="card">
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {household.owner?._id === user?._id ? 'Manage Members' : 'Leave Household'}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                        {household.owner?._id === user?._id 
                          ? 'As admin/owner, leaving will dissolve this household space entirely.' 
                          : 'Leaving will revoke your access to shared family budgets and goals.'}
                      </p>
                      <button
                        onClick={handleLeaveHousehold}
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          color: 'var(--accent-red)',
                          borderColor: 'var(--accent-red)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <LogOut size={16} />
                        {household.owner?._id === user?._id ? 'Dissolve Household' : 'Leave Household'}
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  
                  {/* Create space card */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <PlusCircle size={20} style={{ color: 'var(--accent-green)' }} />
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Create Household</h3>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      Create a shared family workspace to collaborate on monthly category budgets and multi-user goals.
                    </p>
                    <form onSubmit={handleCreateHousehold}>
                      <div className="form-group">
                        <label className="form-label">Household Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Sharma Family"
                          value={newHouseholdName}
                          onChange={(e) => setNewHouseholdName(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Space</button>
                    </form>
                  </div>

                  {/* Join space card */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <Link2 size={20} style={{ color: 'var(--accent-orange)' }} />
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Join Household</h3>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      Enter a 6-character invitation code provided by an existing household administrator.
                    </p>
                    <form onSubmit={handleJoinHousehold}>
                      <div className="form-group">
                        <label className="form-label">Invite Code</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. ABC123"
                          value={inviteCodeInput}
                          onChange={(e) => setInviteCodeInput(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>Join Space</button>
                    </form>
                  </div>

                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={20} style={{ color: 'var(--accent-green)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Activity History</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListFilter size={16} style={{ color: 'var(--text-muted)' }} />
                  <select
                    className="form-select"
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', width: '160px' }}
                    value={selectedResourceType}
                    onChange={(e) => setSelectedResourceType(e.target.value)}
                  >
                    <option value="">All Resource Types</option>
                    <option value="Expense">Expense</option>
                    <option value="Budget">Budget</option>
                    <option value="Investment">Investment</option>
                    <option value="Goal">Goal</option>
                    <option value="RecurringExpense">Recurring Expense</option>
                  </select>
                </div>
              </div>

              {logsError && <div className="alert-box alert-box-error">{logsError}</div>}

              {logsLoading && logs.length === 0 ? (
                <div className="empty-state">Loading activity logs...</div>
              ) : logs.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 0' }}>
                  <Clock size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No actions logged yet in this account.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {logs.map((log) => {
                    const timeStr = new Date(log.timestamp).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div
                        key={log._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-color)',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {getLogIcon(log.action)}
                          <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {log.resourceType}
                            </span>
                            <div style={{ fontSize: '0.88rem', fontWeight: 500, marginTop: '2px' }}>
                              {formatAuditDiff(log)}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {timeStr}
                        </span>
                      </div>
                    );
                  })}

                  {hasMoreLogs && (
                    <button
                      onClick={() => fetchActivityLogs(false)}
                      className="btn btn-secondary"
                      style={{ marginTop: '1rem', width: '100%', fontSize: '0.85rem' }}
                      disabled={logsLoading}
                    >
                      {logsLoading ? 'Loading...' : 'Load More Logs'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Profile;
