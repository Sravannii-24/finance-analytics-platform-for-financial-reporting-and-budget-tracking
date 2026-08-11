import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { householdAPI } from '../services/api';
import { Users, PlusCircle, LogOut, Link2 } from 'lucide-react';

const Household = () => {
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const fetchHousehold = async () => {
    setLoading(true);
    try {
      const res = await householdAPI.getHousehold();
      if (res.data.success) {
        setHousehold(res.data.data);
      }
    } catch (err) {
      setError('Error loading household info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHousehold();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name) return setError('Please enter a household name');
    try {
      const res = await householdAPI.createHousehold({ name });
      if (res.data.success) {
        setSuccess(`Household "${name}" created!`);
        setName('');
        fetchHousehold();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating household');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!inviteCode) return setError('Please enter an invite code');
    try {
      const res = await householdAPI.joinHousehold({ inviteCode });
      if (res.data.success) {
        setSuccess('Joined household successfully!');
        setInviteCode('');
        fetchHousehold();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error joining household');
    }
  };

  const handleLeave = async () => {
    const msg = household.admin._id === household.members[0]._id // Simple admin check (or match current user id)
      ? 'Dissolve this household? All members will be detached.'
      : 'Leave this household?';
    if (!window.confirm(msg)) return;

    setError(''); setSuccess('');
    try {
      const res = await householdAPI.leaveHousehold();
      if (res.data.success) {
        setSuccess(res.data.message || 'Left household');
        setHousehold(null);
        fetchHousehold();
      }
    } catch (err) {
      setError('Error leaving household');
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Household Management" />
        <div className="content-body">
          {error && <div className="alert-box alert-box-error">{error}</div>}
          {success && <div className="alert-box alert-box-success">{success}</div>}

          {loading ? (
            <div className="card empty-state">Loading household data...</div>
          ) : household ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
              
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <Users size={24} style={{ color: '#10b981' }} />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{household.name} Members</h3>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {household.members.map((member) => (
                        <tr key={member._id}>
                          <td style={{ fontWeight: 600 }}>{member.name}</td>
                          <td>{member.email}</td>
                          <td>
                            <span 
                              className="category-tag" 
                              style={{ 
                                backgroundColor: household.admin._id === member._id ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                                color: household.admin._id === member._id ? '#10b981' : 'var(--text-secondary)'
                              }}
                            >
                              {household.admin._id === member._id ? 'Admin' : 'Member'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Invite Code</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.05em', color: '#10b981' }}>{household.inviteCode}</span>
                    <button 
                      className="icon-btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(household.inviteCode);
                        alert('Invite code copied to clipboard!');
                      }}
                      title="Copy Code"
                    >
                      <Link2 size={16} />
                    </button>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Share this code with other users so they can join your family space.</p>
                </div>

                <div className="card">
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem' }}>Danger Zone</h4>
                  <button 
                    onClick={handleLeave} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', color: '#ef4444', borderColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <LogOut size={16} />
                    {household.admin._id === household.members[0]._id ? 'Dissolve Household' : 'Leave Household'}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <PlusCircle size={20} style={{ color: '#10b981' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Create a Household</h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Establish a new family household space to track shared bills, monthly budgets, and general expenses collectively.
                </p>
                <form onSubmit={handleCreate}>
                  <div className="form-group">
                    <label className="form-label">Household Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. The Smiths" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Space</button>
                </form>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <Link2 size={20} style={{ color: '#f97316' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Join a Household</h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Enter an invite code provided by a household administrator to merge your accounts into a single collaborative family workspace.
                </p>
                <form onSubmit={handleJoin}>
                  <div className="form-group">
                    <label className="form-label">Invite Code *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. HSH-ABC123" 
                      value={inviteCode} 
                      onChange={(e) => setInviteCode(e.target.value)} 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>Join Space</button>
                </form>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Household;
