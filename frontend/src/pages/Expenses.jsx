import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { expenseAPI, budgetAPI, recurringExpenseAPI } from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import { Plus, Edit2, Trash2, X, Filter, Search, Smartphone, Wallet, Repeat } from 'lucide-react';

const ExpenseRow = React.memo(({ expense, onEdit, onDelete }) => {
  const mode = expense.paymentMode || 'Offline';
  const method = expense.paymentMethod || 'Cash';
  const isRecurring = !!expense.recurringExpenseId;
  return (
    <tr>
      <td>{new Date(expense.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' })}</td>
      <td style={{ fontWeight: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span>{expense.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>}</span>
          {expense.user && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
              {expense.user.name}
            </span>
          )}
          {isRecurring && (
            <span 
              style={{ 
                backgroundColor: 'rgba(59,130,246,0.12)', 
                color: '#3b82f6', 
                fontSize: '0.65rem', 
                padding: '1px 6px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Auto-created from recurring payment"
            >
              <Repeat size={10} />
              Auto
            </span>
          )}
        </div>
      </td>
      <td><span className={`category-tag tag-${expense.category}`}>{expense.category}</span></td>
      <td>
        <span className={`category-tag`} style={{ 
          backgroundColor: mode === 'Online' ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)',
          color: mode === 'Online' ? '#10b981' : '#f97316',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {mode === 'Online' ? <Smartphone size={12} /> : <Wallet size={12} />}
          <span>{method}</span>
        </span>
      </td>
      <td className="text-right expense-amount">{formatCurrency(expense.amount)}</td>
      <td className="text-right">
        <div className="actions-cell">
          <button className="icon-btn" onClick={() => onEdit(expense)} title="Edit"><Edit2 size={16} /></button>
          <button className="icon-btn icon-btn-danger" onClick={() => onDelete(expense._id)} title="Delete"><Trash2 size={16} /></button>
        </div>
      </td>
    </tr>
  );
});

const Expenses = () => {
  const getInitialMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editId, setEditId] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState('');
  const [paymentMode, setPaymentMode] = useState('Online');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [modalError, setModalError] = useState('');
  const [budgets, setBudgets] = useState([]);

  // Recurring Expenses state
  const [activeSubTab, setActiveSubTab] = useState('One-time'); // 'One-time' | 'Recurring'
  const [recurringRules, setRecurringRules] = useState([]);
  const [isRecurringForm, setIsRecurringForm] = useState(false);
  const [frequency, setFrequency] = useState('Monthly');
  const [showHousehold, setShowHousehold] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(20);
  }, [selectedMonth, selectedCategory, selectedPaymentMode, debouncedSearchQuery, showHousehold]);

  const categories = ['Food', 'Housing', 'Transport', 'Utilities', 'Entertainment', 'Other'];

  const fetchExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {};
      if (selectedMonth) filters.month = selectedMonth;
      if (selectedCategory) filters.category = selectedCategory;
      if (selectedPaymentMode) filters.paymentMode = selectedPaymentMode;
      if (showHousehold) filters.scope = 'household';
      const response = await expenseAPI.getExpenses(filters);
      if (response.data.success) setExpenses(response.data.data);
    } catch { setError('Error loading expenses'); }
    finally { setLoading(false); }
  };

  const fetchBudgets = async () => {
    if (!selectedMonth) return;
    try {
      const response = await budgetAPI.getUtilization(selectedMonth);
      if (response.data.success) setBudgets(response.data.data);
    } catch { console.error('Budget fetch error'); }
  };

  const fetchRecurringRules = async () => {
    try {
      const response = await recurringExpenseAPI.getRules();
      if (response.data.success) setRecurringRules(response.data.data);
    } catch (err) {
      console.error('Error fetching recurring rules:', err);
    }
  };

  useEffect(() => { 
    fetchExpenses(); 
    fetchBudgets(); 
    fetchRecurringRules();
  }, [selectedMonth, selectedCategory, selectedPaymentMode, showHousehold]);

  const handleOpenAddModal = () => {
    setEditId(null); setAmount(''); setCategory('Food');
    setDate(new Date().toISOString().substring(0, 10));
    setDescription(''); setPaymentMode('Online'); setPaymentMethod('UPI');
    setFrequency('Monthly'); setIsRecurringForm(activeSubTab === 'Recurring');
    setModalError(''); setShowModal(true);
  };

  const handleOpenEditModal = useCallback((expense) => {
    setEditId(expense._id); setAmount(expense.amount.toString()); setCategory(expense.category);
    setDate(new Date(expense.date).toISOString().substring(0, 10));
    setDescription(expense.description || '');
    setPaymentMode(expense.paymentMode || 'Offline');
    setPaymentMethod(expense.paymentMethod || 'Cash');
    setIsRecurringForm(false);
    setModalError(''); setShowModal(true);
  }, []);

  const openEditRecurringModal = (rule) => {
    setEditId(rule._id); setAmount(rule.amount.toString()); setCategory(rule.category);
    setDate(new Date(rule.nextDueDate).toISOString().substring(0, 10));
    setDescription(rule.description || '');
    setFrequency(rule.frequency);
    setIsRecurringForm(true);
    setModalError(''); setShowModal(true);
  };

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expenseAPI.deleteExpense(id);
      setSuccess('Expense deleted!'); fetchExpenses(); fetchBudgets();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Error deleting expense'); }
  }, [expenses, budgets]);

  const handleTogglePause = async (rule) => {
    try {
      const response = await recurringExpenseAPI.updateRule(rule._id, { isActive: !rule.isActive });
      if (response.data.success) {
        setSuccess(rule.isActive ? 'Recurring rule paused' : 'Recurring rule resumed');
        fetchRecurringRules();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Error toggling rule status');
    }
  };

  const handleDeleteRecurring = async (id) => {
    if (!window.confirm('Delete this recurring rule?')) return;
    try {
      await recurringExpenseAPI.deleteRule(id);
      setSuccess('Recurring rule deleted');
      fetchRecurringRules();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Error deleting recurring rule');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setModalError('');
    if (!amount || !category || !date) return setModalError('Please fill in all required fields');
    if (Number(amount) <= 0) return setModalError('Amount must be a positive number');

    try {
      if (isRecurringForm) {
        const payload = { amount: Number(amount), category, nextDueDate: date, description, frequency };
        let response;
        if (editId) response = await recurringExpenseAPI.updateRule(editId, payload);
        else response = await recurringExpenseAPI.createRule(payload);

        if (response.data.success) {
          setSuccess(editId ? 'Recurring rule updated!' : 'Recurring rule created!');
          setShowModal(false); fetchRecurringRules();
          setTimeout(() => setSuccess(''), 3000);
        }
      } else {
        const payload = { amount: Number(amount), category, date, description, paymentMode, paymentMethod };
        let response;
        if (editId) response = await expenseAPI.updateExpense(editId, payload);
        else response = await expenseAPI.addExpense(payload);

        if (response.data.success) {
          const budgetLimit = budgets.find((b) => b.category === category);
          if (budgetLimit && budgetLimit.budget > 0) {
            const prevAmt = editId ? (expenses.find((e) => e._id === editId)?.amount || 0) : 0;
            const newSpent = budgetLimit.spent + Number(amount) - prevAmt;
            const newPct = (newSpent / budgetLimit.budget) * 100;
            if (newPct >= 90) {
              alert(`⚠️ Budget alert! ${category} is now at ${newPct.toFixed(1)}% of your monthly limit.`);
            }
          }
          setSuccess(editId ? 'Expense updated!' : 'Expense added!');
          setShowModal(false); fetchExpenses(); fetchBudgets();
          setTimeout(() => setSuccess(''), 3000);
        }
      }
    } catch (err) { setModalError(err.response?.data?.message || 'Error saving transaction'); }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Expenses" />
        <div className="content-body">
          
          {/* Sub Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveSubTab('One-time')}
              className={`btn ${activeSubTab === 'One-time' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Expenses List
            </button>
            <button
              onClick={() => setActiveSubTab('Recurring')}
              className={`btn ${activeSubTab === 'Recurring' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              Recurring Rules
            </button>
            
            {activeSubTab === 'Recurring' && (
              <button
                className="btn btn-secondary animate-pulse"
                style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={async () => {
                  try {
                    await recurringExpenseAPI.runCheck();
                    setSuccess('Recurring rules check executed!');
                    fetchExpenses();
                    fetchRecurringRules();
                    setTimeout(() => setSuccess(''), 3000);
                  } catch {
                    setError('Error running recurring check');
                  }
                }}
              >
                <Repeat size={14} /> Run Rules Check
              </button>
            )}
          </div>

          {error && <div className="alert-box alert-box-error">{error}</div>}
          {success && <div className="alert-box alert-box-success">{success}</div>}

          {activeSubTab === 'One-time' ? (
            <>
              <div className="card mb-md">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Filter size={18} /><span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Filters</span>
                    </div>
                    <input type="month" className="form-input" style={{ width: '170px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                    <select className="form-select" style={{ width: '170px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                      <option value="">All Categories</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="form-select" style={{ width: '170px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }} value={selectedPaymentMode} onChange={(e) => setSelectedPaymentMode(e.target.value)}>
                      <option value="">All Payment Modes</option>
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        id="household-toggle"
                        checked={showHousehold}
                        onChange={(e) => setShowHousehold(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: '#10b981' }}
                      />
                      <label htmlFor="household-toggle" style={{ cursor: 'pointer', fontWeight: 600 }}>Show Household</label>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: '220px', padding: '0.5rem 0.75rem 0.5rem 2rem', fontSize: '0.85rem' }}
                        placeholder="Search description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={handleOpenAddModal}><Plus size={18} /><span>Add Expense</span></button>
                </div>
              </div>

              {(() => {
                const filteredExpenses = expenses.filter((e) =>
                  (e.description || '').toLowerCase().includes(debouncedSearchQuery.toLowerCase())
                );
                const paginatedExpenses = filteredExpenses.slice(0, visibleCount);

                return (
                  <div className="card table-card">
                    <div className="table-header">
                      <h3 className="chart-title" style={{ margin: 0 }}>Transactions</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {filteredExpenses.length} record(s) {debouncedSearchQuery && '(filtered)'}
                      </span>
                    </div>
                    {loading ? (
                      <div className="empty-state">Loading...</div>
                    ) : filteredExpenses.length === 0 ? (
                      <div className="empty-state">
                        <p>No expenses found.</p>
                        <button className="btn btn-secondary mt-md" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }} onClick={handleOpenAddModal}>Add First Expense</button>
                      </div>
                    ) : (
                      <>
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr><th>Date</th><th>Description</th><th>Category</th><th>Payment</th><th className="text-right">Amount</th><th className="text-right">Actions</th></tr>
                            </thead>
                            <tbody>
                              {paginatedExpenses.map((expense) => (
                                <ExpenseRow
                                  key={expense._id}
                                  expense={expense}
                                  onEdit={handleOpenEditModal}
                                  onDelete={handleDelete}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {filteredExpenses.length > visibleCount && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', paddingBottom: '0.5rem' }}>
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
                );
              })()}
            </>
          ) : (
            <>
              {/* Recurring Rules Tab view */}
              <div className="card mb-md">
                <div className="flex-between">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Recurring Payment Automation</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rules are automatically processed daily at midnight IST.</p>
                  </div>
                  <button className="btn btn-primary" onClick={handleOpenAddModal}>
                    <Plus size={18} /> Add Rule
                  </button>
                </div>
              </div>

              {recurringRules.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <Repeat size={40} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recurring transaction rules configured yet.</p>
                  <button className="btn btn-secondary mt-md" style={{ fontSize: '0.85rem', padding: '0.5rem 1.5rem' }} onClick={handleOpenAddModal}>
                    Add First Rule
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                  {recurringRules.map((rule) => (
                    <div key={rule._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', border: rule.isActive ? '1px solid rgba(16,185,129,0.15)' : '1px solid var(--border-color)' }}>
                      <div className="flex-between">
                        <span className={`category-tag tag-${rule.category}`}>{rule.category}</span>
                        <span 
                          className="category-tag" 
                          style={{ 
                            backgroundColor: rule.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)', 
                            color: rule.isActive ? '#10b981' : '#f97316',
                            fontSize: '0.7rem'
                          }}
                        >
                          {rule.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, margin: '2px 0' }}>
                        {formatCurrency(rule.amount)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ {rule.frequency}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Description:</strong> {rule.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None</span>}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <strong>Next Execution:</strong> {new Date(rule.nextDueDate).toLocaleDateString('en-IN')}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', height: '32px' }}
                          onClick={() => handleTogglePause(rule)}
                        >
                          {rule.isActive ? 'Pause Rule' : 'Resume Rule'}
                        </button>
                        <button
                          className="icon-btn"
                          style={{ height: '32px', width: '32px' }}
                          onClick={() => openEditRecurringModal(rule)}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="icon-btn icon-btn-danger"
                          style={{ height: '32px', width: '32px' }}
                          onClick={() => handleDeleteRecurring(rule._id)}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {isRecurringForm 
                  ? (editId ? 'Edit Recurring Rule' : 'Add Recurring Rule')
                  : (editId ? 'Edit Expense' : 'Add New Expense')
                }
              </h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            {modalError && <div className="alert-box alert-box-error">{modalError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input type="number" className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 450" step="0.01" min="0.01" required />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)} required>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {isRecurringForm ? (
                <div className="form-group">
                  <label className="form-label">Frequency *</label>
                  <select className="form-select" value={frequency} onChange={(e) => setFrequency(e.target.value)} required>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Payment Mode *</label>
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMode('Online');
                          setPaymentMethod('UPI');
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: paymentMode === 'Online' ? 'var(--accent-green)' : 'transparent',
                          color: paymentMode === 'Online' ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.2s',
                        }}
                      >
                        Online
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMode('Offline');
                          setPaymentMethod('Cash');
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: paymentMode === 'Offline' ? 'var(--accent-orange)' : 'transparent',
                          color: paymentMode === 'Offline' ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.2s',
                        }}
                      >
                        Offline
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Method *</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      required
                    >
                      {paymentMode === 'Offline' ? (
                        <option value="Cash">Cash</option>
                      ) : (
                        <>
                          <option value="UPI">UPI</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Debit Card">Debit Card</option>
                          <option value="Net Banking">Net Banking</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Other">Other</option>
                        </>
                      )}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">{isRecurringForm ? 'Next Due Date *' : 'Date *'}</label>
                <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" style={{ resize: 'vertical', minHeight: '80px' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isRecurringForm ? "e.g. Broadband subscription" : "e.g. Weekly groceries"}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {isRecurringForm 
                    ? (editId ? 'Save Rule' : 'Create Rule')
                    : (editId ? 'Save Changes' : 'Add Expense')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
