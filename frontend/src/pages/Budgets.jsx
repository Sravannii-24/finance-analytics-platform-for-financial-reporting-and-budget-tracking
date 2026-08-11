import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { budgetAPI } from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import { AlertTriangle, HelpCircle, Edit2, Check, X, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Budgets = () => {
  const { user } = useAuth();

  const getInitialMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [scope, setScope] = useState('personal');
  const [utilizationData, setUtilizationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUtilization = async () => {
    setLoading(true); setError('');
    try {
      const response = await budgetAPI.getUtilization(selectedMonth, scope);
      if (response.data.success) setUtilizationData(response.data.data);
    } catch { setError('Error loading budget data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUtilization(); }, [selectedMonth, scope]);

  const handleSaveBudget = async (category) => {
    if (editAmount === '' || isNaN(editAmount) || Number(editAmount) < 0) {
      return setError('Please enter a valid amount');
    }
    try {
      await budgetAPI.setBudget({
        category,
        amount: Number(editAmount),
        month: selectedMonth,
        household: scope === 'household' ? user?.household : null
      });
      setSuccess(`Budget for ${category} updated!`);
      setEditingCategory(null); setEditAmount(''); fetchUtilization();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Error saving budget'); }
  };

  const getProgressBarColor = (pct) => {
    if (pct >= 90) return 'progress-red';
    if (pct >= 70) return 'progress-orange';
    return 'progress-green';
  };

  const alerts = utilizationData.filter((item) => item.budget > 0 && item.percentage >= 90);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Budgets" />
        <div className="content-body">
          <div className="card mb-md">
            <div className="flex-between">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Month</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Configure budgets per period</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {user?.household && (
                  <select className="form-input" style={{ width: '200px' }} value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="personal">Personal Budgets</option>
                    <option value="household">Household Budgets</option>
                  </select>
                )}
                <input type="month" className="form-input" style={{ width: '200px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="alert-banner">
              <AlertTriangle className="alert-icon" size={20} />
              <div className="alert-message">
                <strong>Budget Warning:</strong> You have exceeded 90% in{' '}
                {alerts.map((item, i) => (
                  <span key={item.category}><strong>{item.category}</strong> ({item.percentage}%){i < alerts.length - 1 ? ', ' : ''}</span>
                ))}.
              </div>
            </div>
          )}

          {error && <div className="alert-box alert-box-error">{error}</div>}
          {success && <div className="alert-box alert-box-success">{success}</div>}

          {loading ? (
            <div className="empty-state">Loading budgets...</div>
          ) : (
            <div className="dashboard-grid mt-md">
              {utilizationData.map((item) => {
                const isEditing = editingCategory === item.category;
                const hasBudget = item.budget > 0;
                return (
                  <div key={item.category} className="card metric-card">
                    <div>
                      <div className="flex-between mb-md">
                        <span className={`category-tag tag-${item.category}`}>{item.category}</span>
                        {item.percentage >= 100 ? <span className="badge-alert">Over Limit</span>
                          : item.percentage >= 90 ? <span className="badge-warning">90%+ Alert</span>
                          : hasBudget ? <span className="badge-success">On Track</span>
                          : null}
                      </div>

                      {isEditing ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Set Budget (₹)</label>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input type="number" className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="Amount" min="0" autoFocus />
                            <button className="icon-btn" onClick={() => handleSaveBudget(item.category)} style={{ color: 'var(--accent-green)' }}><Check size={18} /></button>
                            <button className="icon-btn" onClick={() => setEditingCategory(null)} style={{ color: 'var(--accent-red)' }}><X size={18} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-between" style={{ margin: '0.5rem 0' }}>
                          <div>
                            <span className="metric-desc">Monthly Budget</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{hasBudget ? formatCurrency(item.budget) : '—'}</span>
                              <button className="icon-btn" onClick={() => { setEditingCategory(item.category); setEditAmount(item.budget > 0 ? item.budget.toString() : ''); }} style={{ padding: '0.2rem' }}><Edit2 size={12} /></button>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="metric-desc">Spent</span>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: hasBudget && item.spent > item.budget ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                              {formatCurrency(item.spent)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '1rem' }}>
                      {hasBudget ? (
                        <>
                          <div className="flex-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>Utilization</span>
                            <span style={{ fontWeight: 600 }}>{item.percentage}%</span>
                          </div>
                          <div className="progress-container">
                            <div className={`progress-bar ${getProgressBarColor(item.percentage)}`} style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                          </div>
                        </>
                      ) : (
                        <div className="flex-center gap-sm" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                          <HelpCircle size={14} /><span>No budget set</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Budgets;
