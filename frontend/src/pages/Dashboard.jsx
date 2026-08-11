import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { expenseAPI, budgetAPI, investmentAPI, goalsAPI, analyticsAPI } from '../services/api';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatCurrency';
import { TrendingUp, TrendingDown, PiggyBank, Percent, AlertTriangle, Target, Briefcase, Lightbulb, Activity } from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getInitialMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [scope, setScope] = useState('personal');
  const [expenses, setExpenses] = useState([]);
  const [utilizationData, setUtilizationData] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [investmentSummary, setInvestmentSummary] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [healthScore, setHealthScore] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);

  const COLORS = {
    Food: '#3b82f6', Housing: '#8b5cf6', Transport: '#f59e0b',
    Utilities: '#10b981', Entertainment: '#ec4899', Other: '#6b7280',
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expRes, utRes, allRes, perfRes, goalsRes, hsRes, recRes, pbRes] = await Promise.allSettled([
        expenseAPI.getExpenses({ month: selectedMonth, scope }),
        budgetAPI.getUtilization(selectedMonth, scope),
        expenseAPI.getExpenses({ scope }),
        investmentAPI.getPerformance(),
        goalsAPI.getGoals(scope),
        analyticsAPI.getHealthScore(),
        analyticsAPI.getRecommendations(),
        expenseAPI.getPaymentBreakdown(selectedMonth, scope),
      ]);
      const get = (r) => r.status === 'fulfilled' ? r.value : null;
      const expD = get(expRes); if (expD?.data?.success) setExpenses(expD.data.data);
      const utD = get(utRes); if (utD?.data?.success) setUtilizationData(utD.data.data);
      const allD = get(allRes); if (allD?.data?.success) setAllExpenses(allD.data.data);
      const perfD = get(perfRes); if (perfD?.data?.success) setInvestmentSummary(perfD.data.data.summary);
      const goalsD = get(goalsRes); if (goalsD?.data?.success) setGoals(goalsD.data.data.filter((g) => g.status !== 'Completed').slice(0, 3));
      const hsD = get(hsRes); if (hsD?.data?.success) setHealthScore(hsD.data.data);
      const recD = get(recRes); if (recD?.data?.success) setRecommendations(recD.data.data.slice(0, 3));
      const pbD = get(pbRes); if (pbD?.data?.success) setPaymentBreakdown(pbD.data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedMonth, user, scope]);

  const totalIncome = user?.monthlyIncome || 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSavings = totalIncome - totalExpenses;
  const totalBudget = utilizationData.reduce((sum, item) => sum + item.budget, 0);
  const overallUtilization = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
  const isBudgetWarning = overallUtilization >= 90;

  const pieData = utilizationData.filter((item) => item.spent > 0).map((item) => ({
    name: item.category, value: item.spent, color: COLORS[item.category] || '#9ca3af',
  }));

  const trendData = (() => {
    const monthsName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mExp = allExpenses
        .filter((e) => {
          const ed = new Date(e.date);
          return `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}` === mStr;
        })
        .reduce((sum, e) => sum + e.amount, 0);
      return { name: `${monthsName[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`, Income: totalIncome, Expenses: Number(mExp.toFixed(0)) };
    });
  })();

  const invGain = (investmentSummary?.overallAbsoluteReturn || 0) >= 0;

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Dashboard" />
        <div className="content-body">

          {/* Welcome bar */}
          <div className="card mb-md">
            <div className="flex-between">
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Welcome back, {user?.name}!
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Here is your financial overview</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {user?.household && (
                  <select className="form-input" style={{ width: '160px' }} value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="personal">Personal View</option>
                    <option value="household">Household View</option>
                  </select>
                )}
                <input type="month" className="form-input" style={{ width: '200px' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </div>
            </div>
          </div>

          {isBudgetWarning && (
            <div className="alert-banner">
              <AlertTriangle className="alert-icon" size={20} />
              <div className="alert-message">
                <strong>Budget Alert:</strong> Overall budget utilization is at <strong>{overallUtilization}%</strong>. Consider reducing expenses!
              </div>
            </div>
          )}

          {loading ? (
            <>
              <div className="dashboard-grid">
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card"></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="card skeleton skeleton-card" style={{ height: '200px' }}></div>
                <div className="card skeleton skeleton-card" style={{ height: '200px' }}></div>
              </div>
              <div className="charts-grid">
                <div className="card chart-card skeleton skeleton-chart"></div>
                <div className="card chart-card skeleton skeleton-chart"></div>
              </div>
            </>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="dashboard-grid">
                <div className="card metric-card">
                  <div className="metric-header"><span>Monthly Income</span><div className="metric-icon icon-green"><TrendingUp size={20} /></div></div>
                  <div className="metric-value">{formatCurrency(totalIncome)}</div>
                  <span className="metric-desc">Set in profile settings</span>
                </div>
                <div className="card metric-card">
                  <div className="metric-header"><span>Total Expenses</span><div className="metric-icon icon-red"><TrendingDown size={20} /></div></div>
                  <div className="metric-value" style={{ color: 'var(--accent-red)' }}>{formatCurrency(totalExpenses)}</div>
                  <span className="metric-desc">Spent this period</span>
                </div>
                <div className="card metric-card">
                  <div className="metric-header"><span>Savings Balance</span><div className="metric-icon icon-blue"><PiggyBank size={20} /></div></div>
                  <div className="metric-value" style={{ color: totalSavings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>{formatCurrency(totalSavings)}</div>
                  <span className="metric-desc">Income minus expenses</span>
                </div>
                <div className="card metric-card">
                  <div className="metric-header"><span>Budget Used</span><div className="metric-icon icon-orange"><Percent size={20} /></div></div>
                  <div className="metric-value" style={{ color: isBudgetWarning ? 'var(--accent-red)' : 'var(--text-primary)' }}>{overallUtilization}%</div>
                  <span className="metric-desc">{totalBudget > 0 ? `${formatCurrency(totalExpenses)} of ${formatCurrency(totalBudget)}` : 'No budgets set'}</span>
                </div>
              </div>

              {/* Investment + Goals widgets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Investment Widget */}
                <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/investments')}>
                  <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Portfolio Overview</h3>
                    <Briefcase size={18} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  {investmentSummary ? (
                    <>
                      <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                          <div className="metric-desc">Current Value</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{formatCurrency(investmentSummary.totalCurrentValue)}</div>
                        </div>
                        <div>
                          <div className="metric-desc">Returns</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: invGain ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {invGain ? '+' : ''}{investmentSummary.overallPercentReturn.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Invested: {formatCurrency(investmentSummary.totalInvested)} → Click to view details
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No investments yet. Click to add holdings →</div>
                  )}
                </div>

                {/* Goals Widget */}
                <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/goals')}>
                  <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Active Goals</h3>
                    <Target size={18} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  {goals.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No active goals. Click to create one →</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {goals.map((g) => (
                        <div key={g._id}>
                          <div className="flex-between" style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 600 }}>{g.goalName}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{g.progressPercent}%</span>
                          </div>
                          <div className="progress-container" style={{ height: '6px' }}>
                            <div
                              className={`progress-bar ${g.status === 'At Risk' ? 'progress-orange' : 'progress-green'}`}
                              style={{ width: `${Math.min(g.progressPercent, 100)}%` }}
                            />
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Health Score + AI Insights widgets */}
              {(healthScore || recommendations.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

                  {/* Health Score Mini Gauge */}
                  {healthScore && (
                    <div className="card" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1.5rem' }} onClick={() => navigate('/analytics')}
                    >
                      {/* SVG mini gauge */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx={45} cy={45} r={35} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
                          <circle
                            cx={45} cy={45} r={35} fill="none"
                            stroke={healthScore.color}
                            strokeWidth={8}
                            strokeDasharray={2 * Math.PI * 35}
                            strokeDashoffset={2 * Math.PI * 35 * (1 - healthScore.overall / 100)}
                            strokeLinecap="round"
                          />
                          <text x={45} y={45} textAnchor="middle" dominantBaseline="middle"
                            fill={healthScore.color} fontSize={18} fontWeight={800}
                            style={{ transform: 'rotate(90deg)', transformOrigin: '45px 45px' }}>
                            {healthScore.overall}
                          </text>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Financial Health Score</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: healthScore.color }}>{healthScore.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Click to see full breakdown →</div>
                      </div>
                    </div>
                  )}

                  {/* AI Insights */}
                  {recommendations.length > 0 && (
                    <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate('/analytics')}
                    >
                      <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Lightbulb size={16} style={{ color: '#10b981' }} />
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>AI Insights</h3>
                        </div>
                        <Activity size={16} style={{ color: 'var(--text-secondary)' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {recommendations.map((rec) => (
                          <div key={rec.id} style={{
                            padding: '8px 12px',
                            background: rec.type === 'warning' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                            borderLeft: `3px solid ${rec.type === 'warning' ? '#ef4444' : '#10b981'}`,
                            borderRadius: '0 8px 8px 0',
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                          }}>
                            <strong style={{ color: rec.type === 'warning' ? '#ef4444' : '#10b981', display: 'block', marginBottom: '2px' }}>
                              {rec.title}
                            </strong>
                            {rec.description.substring(0, 80)}{rec.description.length > 80 ? '...' : ''}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '0.75rem', textAlign: 'right' }}>View all recommendations →</div>
                    </div>
                  )}
                </div>
              )}

              {/* Charts */}
              <div className="charts-grid">
                <div className="card chart-card">
                  <h3 className="chart-title">Cash Flow (Last 6 Months)</h3>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={formatCurrencyCompact} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}
                          formatter={(v) => formatCurrency(v)}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Area type="monotone" dataKey="Income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" />
                        <Area type="monotone" dataKey="Expenses" stroke="#f97316" fillOpacity={1} fill="url(#colorExpenses)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card chart-card">
                  <h3 className="chart-title" style={{ marginBottom: paymentBreakdown && (paymentBreakdown.totalOnline > 0 || paymentBreakdown.totalOffline > 0) ? '0.5rem' : '1.5rem' }}>Expense Breakdown</h3>
                  
                  {paymentBreakdown && (paymentBreakdown.totalOnline > 0 || paymentBreakdown.totalOffline > 0) && (
                    <div style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
                      {(() => {
                        const online = paymentBreakdown.totalOnline;
                        const offline = paymentBreakdown.totalOffline;
                        const total = online + offline;
                        const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0;
                        const offlinePct = total > 0 ? 100 - onlinePct : 0;
                        return (
                          <div>
                            <div className="flex-between" style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>
                              <span>Online: {onlinePct}% ({formatCurrency(online)})</span>
                              <span>Offline: {offlinePct}% ({formatCurrency(offline)})</span>
                            </div>
                            <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                              <div style={{ width: `${onlinePct}%`, background: 'var(--accent-green)', transition: 'width 0.5s' }} title="Online" />
                              <div style={{ width: `${offlinePct}%`, background: 'var(--accent-orange)', transition: 'width 0.5s' }} title="Offline" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="chart-container">
                    {pieData.length === 0 ? (
                      <div className="empty-state" style={{ border: 'none', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        No expenses this month.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v) => formatCurrency(v)}
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}
                          />
                          <Legend verticalAlign="bottom" iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="card table-card">
                <div className="table-header">
                  <h3 className="chart-title" style={{ margin: 0 }}>Recent Activity</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Last 5 expenses</span>
                </div>
                {expenses.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>No recent activities.</div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Description</th><th>Category</th><th className="text-right">Amount</th></tr>
                      </thead>
                      <tbody>
                        {expenses.slice(0, 5).map((expense) => (
                          <tr key={expense._id}>
                            <td>{new Date(expense.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' })}</td>
                            <td style={{ fontWeight: 500 }}>{expense.description || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>}</td>
                            <td><span className={`category-tag tag-${expense.category}`}>{expense.category}</span></td>
                            <td className="text-right expense-amount">{formatCurrency(expense.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Dashboard);
