import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, goalsAPI, expenseAPI } from '../services/api';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatCurrency';
import {
  TrendingUp, TrendingDown, PiggyBank, Target,
  AlertTriangle, Lightbulb, Activity, ChevronRight,
  Zap, ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from 'recharts';

// ─── Circular Gauge ───────────────────────────────────────────────
const CircularGauge = ({ score, label, color, size = 180 }) => {
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="middle"
          fill={color}
          fontSize="32" fontWeight="800"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}
        >
          {score}
        </text>
      </svg>
      <span style={{
        fontSize: '1rem', fontWeight: 700, color,
        background: `${color}20`, padding: '4px 16px', borderRadius: '20px',
      }}>
        {label}
      </span>
    </div>
  );
};

// ─── Factor Bar ────────────────────────────────────────────────────
const FactorBar = ({ name, score, weight, description, color }) => (
  <div style={{ marginBottom: '1.2rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
      <div>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>weight: {weight}%</span>
      </div>
      <span style={{ fontWeight: 700, fontSize: '0.95rem', color }}>{score}/100</span>
    </div>
    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${score}%`, borderRadius: '4px',
        background: `linear-gradient(90deg, ${color}aa, ${color})`,
        transition: 'width 1s ease-out',
      }} />
    </div>
    <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px' }}>{description}</p>
  </div>
);

// ─── Tab Bar ───────────────────────────────────────────────────────
const TABS = ['Overview', 'Spending Analysis', 'Recommendations', 'Health Score', 'Trends'];

const CATEGORY_COLORS = {
  Food: '#3b82f6', Housing: '#8b5cf6', Transport: '#f59e0b',
  Utilities: '#10b981', Entertainment: '#ec4899', Other: '#6b7280',
};

// ─── Main Component ────────────────────────────────────────────────
const Analytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);

  const [spendingData, setSpendingData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [healthScore, setHealthScore] = useState(null);
  const [trends, setTrends] = useState(null);
  const [activeGoalsCount, setActiveGoalsCount] = useState(0);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [sRes, rRes, hRes, tRes, gRes, pRes] = await Promise.all([
          analyticsAPI.getSpendingAnalysis(),
          analyticsAPI.getRecommendations(),
          analyticsAPI.getHealthScore(),
          analyticsAPI.getTrendsPredictions(),
          goalsAPI.getGoals(),
          expenseAPI.getPaymentBreakdown(),
        ]);
        if (sRes.data.success) setSpendingData(sRes.data.data);
        if (rRes.data.success) setRecommendations(rRes.data.data);
        if (hRes.data.success) setHealthScore(hRes.data.data);
        if (tRes.data.success) setTrends(tRes.data.data);
        if (gRes.data.success) setActiveGoalsCount(gRes.data.data.filter((g) => g.status !== 'Completed').length);
        if (pRes.data.success) setPaymentBreakdown(pRes.data.data);
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const monthlyIncome = user?.monthlyIncome || 0;
  const monthlySavings = spendingData ? monthlyIncome - spendingData.totalCurrentSpend : 0;

  // ── Recommendation type styles
  const recStyle = {
    warning:     { border: '#ef4444', icon: <AlertTriangle size={18} />, bg: 'rgba(239,68,68,0.08)', color: '#ef4444' },
    opportunity: { border: '#10b981', icon: <Lightbulb size={18} />,     bg: 'rgba(16,185,129,0.08)', color: '#10b981' },
    info:        { border: '#3b82f6', icon: <Activity size={18} />,      bg: 'rgba(59,130,246,0.08)',  color: '#3b82f6' },
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Analytics" />
        <div className="content-body">

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '5px',
            border: '1px solid var(--border-color)',
            overflowX: 'auto',
          }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  background: activeTab === tab ? 'var(--accent-green)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty-state">Loading analytics...</div>
          ) : (
            <>
              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'Overview' && (
                <div>
                  <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="card metric-card">
                      <div className="metric-header"><span>Monthly Savings</span><div className="metric-icon icon-green"><PiggyBank size={20} /></div></div>
                      <div className="metric-value" style={{ color: monthlySavings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatCurrency(monthlySavings)}
                      </div>
                      <span className="metric-desc">Income minus expenses this month</span>
                    </div>
                    <div className="card metric-card">
                      <div className="metric-header"><span>Avg Monthly Expense</span><div className="metric-icon icon-red"><TrendingDown size={20} /></div></div>
                      <div className="metric-value">{formatCurrency(spendingData?.avgMonthlyExpense || 0)}</div>
                      <span className="metric-desc">3-month rolling average</span>
                    </div>
                    <div className="card metric-card">
                      <div className="metric-header"><span>Projected Balance</span><div className="metric-icon icon-blue"><TrendingUp size={20} /></div></div>
                      <div className="metric-value" style={{ color: (trends?.projectedSavings || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatCurrency(Math.max(0, trends?.projectedSavings || 0))}
                      </div>
                      <span className="metric-desc">Projected savings at month-end</span>
                    </div>
                    <div className="card metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/goals')}>
                      <div className="metric-header"><span>Active Goals</span><div className="metric-icon icon-orange"><Target size={20} /></div></div>
                      <div className="metric-value">{activeGoalsCount}</div>
                      <span className="metric-desc">Goals in progress → click to view</span>
                    </div>
                  </div>

                  {/* Spending Spikes Alert */}
                  {spendingData?.spendingSpikes?.length > 0 && (
                    <div style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                    }}>
                      <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ color: '#ef4444' }}>Spending Spikes Detected</strong>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          {spendingData.spendingSpikes.map((s) => `${s.category} (+${s.changeVsPrev}%)`).join(', ')} — significantly higher than last month.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Quick Health Score */}
                  {healthScore && (
                    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '2rem', cursor: 'pointer' }} onClick={() => setActiveTab('Health Score')}>
                      <CircularGauge score={healthScore.overall} label={healthScore.label} color={healthScore.color} size={140} />
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Financial Health Score</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', maxWidth: '320px' }}>
                          Your composite financial health based on spending, savings, investments, and budget consistency.
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTab('Health Score'); }}
                          style={{
                            background: 'var(--accent-green)',
                            border: 'none',
                            color: '#fff',
                            padding: '6px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          View Breakdown <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SPENDING ANALYSIS TAB ── */}
              {activeTab === 'Spending Analysis' && spendingData && (
                <div>
                  <div className="charts-grid" style={{ marginBottom: '1.5rem' }}>
                    {/* Donut Chart */}
                    <div className="card chart-card">
                      <h3 className="chart-title">Category Breakdown</h3>
                      <div className="chart-container">
                        {spendingData.categoryBreakdown.length === 0 ? (
                          <div className="empty-state" style={{ border: 'none', height: '100%' }}>No expenses this month.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={spendingData.categoryBreakdown}
                                dataKey="amount"
                                nameKey="category"
                                cx="50%" cy="50%"
                                innerRadius={60} outerRadius={90}
                                paddingAngle={4}
                              >
                                {spendingData.categoryBreakdown.map((entry, i) => (
                                  <Cell key={i} fill={CATEGORY_COLORS[entry.category] || '#6b7280'} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(v, name) => [formatCurrency(v), name]}
                                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px' }}
                              />
                              <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* 6-Month Cash Flow */}
                    <div className="card chart-card">
                      <h3 className="chart-title">6-Month Cash Flow</h3>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={spendingData.cashFlowTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gSavings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                            <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={formatCurrencyCompact} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px' }}
                              formatter={(v) => formatCurrency(v)}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Area type="monotone" dataKey="Income" stroke="#10b981" fillOpacity={1} fill="url(#gIncome)" />
                            <Area type="monotone" dataKey="Expenses" stroke="#f97316" fillOpacity={1} fill="url(#gExpenses)" />
                            <Area type="monotone" dataKey="Savings" stroke="#3b82f6" fillOpacity={1} fill="url(#gSavings)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Payment Mode Breakdown Row */}
                  {paymentBreakdown && (
                    <div className="charts-grid" style={{ marginBottom: '1.5rem' }}>
                      {/* Payment Mode Donut Chart */}
                      <div className="card chart-card">
                        <h3 className="chart-title">Payment Mode Split</h3>
                        <div className="chart-container">
                          {paymentBreakdown.totalOnline === 0 && paymentBreakdown.totalOffline === 0 ? (
                            <div className="empty-state" style={{ border: 'none', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              No transactions this period.
                            </div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Online', value: paymentBreakdown.totalOnline },
                                    { name: 'Offline', value: paymentBreakdown.totalOffline },
                                  ]}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%" cy="50%"
                                  innerRadius={55} outerRadius={80}
                                  paddingAngle={5}
                                >
                                  <Cell fill="#10b981" />
                                  <Cell fill="#f97316" />
                                </Pie>
                                <Tooltip
                                  formatter={(v) => formatCurrency(v)}
                                  contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px' }}
                                />
                                <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </div>

                      {/* Payment Method Table */}
                      <div className="card chart-card">
                        <h3 className="chart-title">Payment Methods</h3>
                        <div className="table-wrapper" style={{ flex: 1 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Method</th>
                                <th className="text-right">Txs</th>
                                <th className="text-right">Spent</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentBreakdown.methodBreakdown.map((m) => (
                                <tr key={m.method}>
                                  <td style={{ fontWeight: 600 }}>{m.method}</td>
                                  <td className="text-right">{m.count}</td>
                                  <td className="text-right" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {formatCurrency(m.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category breakdown table */}
                  <div className="card table-card">
                    <h3 className="chart-title">Category Details</h3>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr><th>Category</th><th>Spent</th><th>% of Total</th><th>vs Last Month</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {spendingData.categoryBreakdown.map((c) => (
                            <tr key={c.category}>
                              <td><span className={`category-tag tag-${c.category}`}>{c.category}</span></td>
                              <td style={{ fontWeight: 600 }}>{formatCurrency(c.amount)}</td>
                              <td>{c.pctOfTotal}%</td>
                              <td style={{ color: c.changeVsPrev > 0 ? '#ef4444' : '#10b981' }}>
                                {c.changeVsPrev > 0 ? '+' : ''}{c.changeVsPrev}%
                              </td>
                              <td>
                                {c.isSpike ? (
                                  <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} /> Spike
                                  </span>
                                ) : (
                                  <span style={{ color: '#10b981', fontSize: '0.78rem' }}>Normal</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── RECOMMENDATIONS TAB ── */}
              {activeTab === 'Recommendations' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                    <Lightbulb size={20} style={{ color: '#10b981' }} />
                    <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>AI-Powered Budget Insights</h2>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rule-based, always explainable</span>
                  </div>

                  {recommendations.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                      <ShieldCheck size={48} style={{ color: '#10b981', margin: '0 auto 1rem', display: 'block' }} />
                      <h3 style={{ marginBottom: '0.5rem' }}>You're doing great!</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        No recommendations at this time. Keep maintaining your current financial habits.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {recommendations.map((rec) => {
                        const style = recStyle[rec.type] || recStyle.info;
                        return (
                          <div key={rec.id} style={{
                            background: style.bg,
                            border: `1px solid ${style.border}40`,
                            borderLeft: `4px solid ${style.border}`,
                            borderRadius: '12px',
                            padding: '1.25rem',
                            display: 'flex',
                            gap: '1rem',
                            alignItems: 'flex-start',
                          }}>
                            <div style={{ color: style.color, flexShrink: 0, marginTop: '2px' }}>{style.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '6px' }}>
                                <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{rec.title}</h3>
                                {rec.potentialSavings > 0 && (
                                  <div style={{
                                    background: 'rgba(16,185,129,0.15)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    borderRadius: '8px',
                                    padding: '4px 12px',
                                    flexShrink: 0,
                                  }}>
                                    <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>POTENTIAL SAVING</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                                      {formatCurrency(rec.potentialSavings)}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{rec.description}</p>
                              {rec.category && rec.category !== 'General' && (
                                <span style={{
                                  display: 'inline-block',
                                  marginTop: '8px',
                                  fontSize: '0.72rem',
                                  background: 'rgba(255,255,255,0.07)',
                                  padding: '2px 10px',
                                  borderRadius: '20px',
                                  color: 'var(--text-muted)',
                                }}>
                                  {rec.category}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── HEALTH SCORE TAB ── */}
              {activeTab === 'Health Score' && healthScore && (
                <div>
                  {/* Main Gauge */}
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                      Your Financial Health Score
                    </h2>
                    <CircularGauge score={healthScore.overall} label={healthScore.label} color={healthScore.color} size={200} />
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center', maxWidth: '400px' }}>
                      Score computed from your spending control, savings rate, investment activity, and budget consistency over the last 3 months.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {[{ label: '0–40', text: 'Needs Attention', color: '#ef4444' }, { label: '41–70', text: 'Good', color: '#f59e0b' }, { label: '71–100', text: 'Excellent', color: '#10b981' }].map((r) => (
                        <div key={r.label} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: r.color }} />
                          {r.label}: <span style={{ color: r.color, fontWeight: 600 }}>{r.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Factor Bars */}
                  <div className="card">
                    <h3 className="chart-title" style={{ marginBottom: '1.5rem' }}>Score Breakdown</h3>
                    {healthScore.factors.map((f) => {
                      const c = f.score >= 71 ? '#10b981' : f.score >= 41 ? '#f59e0b' : '#ef4444';
                      return (
                        <FactorBar
                          key={f.name}
                          name={f.name}
                          score={f.score}
                          weight={f.weight}
                          description={f.description}
                          color={c}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── TRENDS & PREDICTIONS TAB ── */}
              {activeTab === 'Trends' && trends && (
                <div>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="card metric-card">
                      <div className="metric-header"><span>Spent So Far</span><div className="metric-icon icon-red"><TrendingDown size={20} /></div></div>
                      <div className="metric-value" style={{ color: 'var(--accent-red)' }}>{formatCurrency(trends.spentSoFar)}</div>
                      <span className="metric-desc">Day {trends.daysElapsed} of {trends.daysInMonth}</span>
                    </div>
                    <div className="card metric-card">
                      <div className="metric-header"><span>Projected Total</span><div className="metric-icon icon-orange"><Zap size={20} /></div></div>
                      <div className="metric-value" style={{ color: trends.projectedTotal > (user?.monthlyIncome || 0) ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                        {formatCurrency(trends.projectedTotal)}
                      </div>
                      <span className="metric-desc">{formatCurrency(trends.dailyRate)}/day avg</span>
                    </div>
                    <div className="card metric-card">
                      <div className="metric-header"><span>Projected Savings</span><div className="metric-icon icon-green"><PiggyBank size={20} /></div></div>
                      <div className="metric-value" style={{ color: trends.projectedSavings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {formatCurrency(Math.abs(trends.projectedSavings))}
                        {trends.projectedSavings < 0 && <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>deficit</span>}
                      </div>
                      <span className="metric-desc">{trends.daysRemaining} days remaining</span>
                    </div>
                  </div>

                  {/* AI Insight Box */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.08))',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}>
                    <Zap size={22} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>AI Projection Insight</strong>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{trends.insight}</p>
                    </div>
                  </div>

                  {/* Trend Chart */}
                  <div className="card chart-card" style={{ height: '340px' }}>
                    <h3 className="chart-title">Month-End Spending Projection</h3>
                    <div style={{ height: '280px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trends.trendData.filter((_, i) => i % 2 === 0 || i === trends.daysElapsed - 1)}
                          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                          <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} interval={2} />
                          <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={formatCurrencyCompact} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px' }}
                            formatter={(v, name) => [v !== null ? formatCurrency(v) : '—', name === 'actual' ? 'Actual Spend' : 'Projected Spend']}
                          />
                          <Legend />
                          <ReferenceLine
                            y={user?.monthlyIncome || 0}
                            stroke="#ef4444"
                            strokeDasharray="5 5"
                            label={{ value: 'Income', position: 'right', fill: '#ef4444', fontSize: 11 }}
                          />
                          <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5} dot={false} name="actual" connectNulls={false} />
                          <Line type="monotone" dataKey="projected" stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" dot={false} name="projected" connectNulls={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
