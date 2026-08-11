import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { goalsAPI } from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import { Plus, Edit2, Trash2, X, Target, PlusCircle, Filter, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GoalCard = React.memo(({ goal, onContrib, onEdit, onDelete, formatCurrency, getProgressColor, getStatusBadge }) => {
  const daysLeft = goal.daysRemaining;
  const timeStr = daysLeft < 0
    ? `${Math.abs(daysLeft)}d overdue`
    : daysLeft <= 365
      ? `${daysLeft}d left`
      : `${(daysLeft / 365).toFixed(1)}y left`;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={18} style={{ color: 'var(--accent-green)' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{goal.goalName}</span>
        </div>
        {getStatusBadge(goal.status)}
      </div>

      {/* Amounts */}
      <div className="flex-between">
        <div>
          <div className="metric-desc">Saved</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            {formatCurrency(goal.currentAmount)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="metric-desc">Target</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(goal.targetAmount)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          <span>{goal.progressPercent}% complete</span>
          <span style={{ color: daysLeft < 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{timeStr}</span>
        </div>
        <div className="progress-container">
          <div
            className={`progress-bar ${getProgressColor(goal.status)}`}
            style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Monthly needed */}
      {goal.status !== 'Completed' && goal.monthlySavingsNeeded > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
          Need <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(goal.monthlySavingsNeeded)}/mo</strong> to hit target on time
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        {goal.status !== 'Completed' && (
          <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }} onClick={() => onContrib(goal)}>
            <PlusCircle size={14} /> Add Funds
          </button>
        )}
        <button className="icon-btn" onClick={() => onEdit(goal)} title="Edit">
          <Edit2 size={16} />
        </button>
        <button className="icon-btn icon-btn-danger" onClick={() => onDelete(goal._id)} title="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
});

const Goals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [scope, setScope] = useState('personal');
  const [filterStatus, setFilterStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showContribModal, setShowContribModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [contribGoal, setContribGoal] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalError, setModalError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Goal form state
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Contribution state
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await goalsAPI.getGoals(scope);
      if (res.data.success) setGoals(res.data.data);
    } catch { setError('Error loading goals'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGoals(); }, [scope]);

  const openAddModal = () => {
    setEditId(null); setGoalName(''); setTargetAmount(''); setTargetDate('');
    setModalError(''); setShowModal(true);
  };

  const openEditModal = useCallback((goal) => {
    setEditId(goal._id); setGoalName(goal.goalName);
    setTargetAmount(goal.targetAmount.toString());
    setTargetDate(new Date(goal.targetDate).toISOString().substring(0, 10));
    setModalError(''); setShowModal(true);
  }, []);

  const openContribModal = useCallback((goal) => {
    setContribGoal(goal); setContribAmount(''); setContribNote('');
    setModalError(''); setShowContribModal(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this goal and all its contributions?')) return;
    try {
      await goalsAPI.deleteGoal(id);
      setSuccess('Goal deleted'); fetchGoals();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Error deleting goal'); }
  }, [goals]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setModalError('');
    if (!goalName || !targetAmount || !targetDate) return setModalError('Please fill in all fields');
    if (Number(targetAmount) <= 0) return setModalError('Target amount must be positive');
    try {
      if (editId) await goalsAPI.updateGoal(editId, { goalName, targetAmount, targetDate, household: scope === 'household' ? user?.household : null });
      else await goalsAPI.createGoal({ goalName, targetAmount, targetDate, household: scope === 'household' ? user?.household : null });
      setShowModal(false); fetchGoals();
      setSuccess(editId ? 'Goal updated!' : 'Goal created!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setModalError(err.response?.data?.message || 'Error saving goal'); }
  };

  const handleContribution = async (e) => {
    e.preventDefault(); setModalError('');
    if (!contribAmount || Number(contribAmount) <= 0) return setModalError('Enter a valid contribution amount');
    try {
      await goalsAPI.updateGoal(contribGoal._id, { contributionAmount: contribAmount, contributionNote: contribNote });
      setShowContribModal(false); fetchGoals();
      setSuccess(`Added ${formatCurrency(Number(contribAmount))} to "${contribGoal.goalName}"!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setModalError(err.response?.data?.message || 'Error adding contribution'); }
  };

  const getProgressColor = (status) => {
    if (status === 'Completed') return 'progress-green';
    if (status === 'At Risk') return 'progress-orange';
    return 'progress-green';
  };

  const getStatusBadge = (status) => {
    if (status === 'Completed') return <span className="badge-success">Completed</span>;
    if (status === 'At Risk') return <span className="badge-warning">At Risk</span>;
    return <span className="badge-success">On Track</span>;
  };

  const filtered = filterStatus === 'All' ? goals : goals.filter((g) => g.status === filterStatus);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Goals" />
        <div className="content-body">

          {error && <div className="alert-box alert-box-error">{error}</div>}
          {success && <div className="alert-box alert-box-success">{success}</div>}

          {/* Action Bar */}
          <div className="card mb-md">
            <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {user?.household && (
                  <select className="form-input" style={{ width: '160px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="personal">Personal Goals</option>
                    <option value="household">Household Goals</option>
                  </select>
                )}
                <Filter size={18} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Filter:</span>
                {['All', 'On Track', 'At Risk', 'Completed'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    style={{
                      padding: '0.3rem 0.9rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                      background: filterStatus === s ? 'var(--accent-green)' : 'var(--bg-secondary)',
                      color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                      border: `1px solid ${filterStatus === s ? 'var(--accent-green)' : 'var(--border-color)'}`,
                    }}
                  >{s}</button>
                ))}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '200px', padding: '0.4rem 0.75rem 0.4rem 2rem', fontSize: '0.8rem' }}
                    placeholder="Search goal name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={18} /> New Goal
              </button>
            </div>
          </div>

          {(() => {
            const filtered = goals.filter((g) => {
              const matchesStatus = filterStatus === 'All' || g.status === filterStatus;
              const matchesSearch = g.goalName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
              return matchesStatus && matchesSearch;
            });

            return (
              <>
                {loading ? (
                  <div className="empty-state">Loading goals...</div>
                ) : filtered.length === 0 ? (
                  <div className="empty-state">
                    <Target size={40} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
                    <p>No goals found.</p>
                    <button className="btn btn-secondary mt-md" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }} onClick={openAddModal}>
                      Create Goal
                    </button>
                  </div>
                ) : (
                  <div className="dashboard-grid">
                    {filtered.map((goal) => (
                      <GoalCard
                        key={goal._id}
                        goal={goal}
                        onContrib={openContribModal}
                        onEdit={openEditModal}
                        onDelete={handleDelete}
                        formatCurrency={formatCurrency}
                        getProgressColor={getProgressColor}
                        getStatusBadge={getStatusBadge}
                      />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Goal Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Goal' : 'New Savings Goal'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            {modalError && <div className="alert-box alert-box-error">{modalError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Goal Name *</label>
                <input type="text" className="form-input" value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder='e.g. Buy a Bike, Emergency Fund' required />
              </div>
              <div className="form-group">
                <label className="form-label">Target Amount (₹) *</label>
                <input type="number" className="form-input" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="e.g. 100000" min="1" required />
              </div>
              <div className="form-group">
                <label className="form-label">Target Date *</label>
                <input type="date" className="form-input" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editId ? 'Save Changes' : 'Create Goal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {showContribModal && contribGoal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Funds — {contribGoal.goalName}</h3>
              <button className="icon-btn" onClick={() => setShowContribModal(false)}><X size={20} /></button>
            </div>
            {modalError && <div className="alert-box alert-box-error">{modalError}</div>}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Current: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(contribGoal.currentAmount)}</strong>
              {' '}/ Target: <strong>{formatCurrency(contribGoal.targetAmount)}</strong>
            </div>
            <form onSubmit={handleContribution}>
              <div className="form-group">
                <label className="form-label">Contribution Amount (₹) *</label>
                <input type="number" className="form-input" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} placeholder="e.g. 5000" min="1" autoFocus required />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input type="text" className="form-input" value={contribNote} onChange={(e) => setContribNote(e.target.value)} placeholder="e.g. Monthly savings" />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowContribModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Funds</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
