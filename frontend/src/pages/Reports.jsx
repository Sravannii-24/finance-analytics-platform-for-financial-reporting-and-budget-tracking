import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { reportsAPI, analyticsAPI, investmentAPI, notificationsAPI } from '../services/api';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatCurrency';
import {
  FileText, ArrowUpRight, ArrowDownRight, Briefcase, TrendingUp, TrendingDown,
  PiggyBank, Target, BarChart2, Bell, AlertTriangle, HelpCircle, FileSpreadsheet, Download
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const CATEGORY_COLORS = {
  Food: '#3b82f6', Housing: '#8b5cf6', Transport: '#f59e0b',
  Utilities: '#10b981', Entertainment: '#ec4899', Other: '#6b7280',
};

const ASSET_COLORS = {
  'Stock':       '#3b82f6',
  'Mutual Fund': '#8b5cf6',
  'ETF':         '#f59e0b',
  'Bond':        '#10b981',
  'Gold':        '#f97316',
  'Cash':        '#6b7280',
  'Other':       '#ec4899',
};

const Reports = () => {
  const getInitialMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Data states
  const [summaryData, setSummaryData] = useState(null);
  const [spendingData, setSpendingData] = useState(null);
  const [investmentPerformance, setInvestmentPerformance] = useState(null);
  const [allocation, setAllocation] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sumRes, spendRes, perfRes, allocRes, alertRes] = await Promise.allSettled([
        reportsAPI.getMonthlySummary(selectedMonth),
        analyticsAPI.getSpendingAnalysis(selectedMonth),
        investmentAPI.getPerformance(),
        investmentAPI.getAllocation(),
        notificationsAPI.getNotifications(),
      ]);

      const get = (r) => r.status === 'fulfilled' ? r.value : null;

      const sumD = get(sumRes); if (sumD?.data?.success) setSummaryData(sumD.data.data);
      const spendD = get(spendRes); if (spendD?.data?.success) setSpendingData(spendD.data.data);
      const perfD = get(perfRes); if (perfD?.data?.success) setInvestmentPerformance(perfD.data.data);
      const allocD = get(allocRes); if (allocD?.data?.success) setAllocation(allocD.data.data);
      const alertD = get(alertRes); if (alertD?.data?.success) setAlerts(alertD.data.data.slice(0, 5));
    } catch (err) {
      setError('Error loading report metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const response = await reportsAPI.exportPDF(selectedMonth);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FinSight-Report-${selectedMonth}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setSuccess('PDF Report downloaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error generating PDF Report');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const response = await reportsAPI.exportExcel(selectedMonth);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `FinSight-Report-${selectedMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setSuccess('Excel Workbook downloaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error generating Excel Workbook');
    } finally {
      setExportingExcel(false);
    }
  };

  // Plain-English client-side summary bullets
  const generateSummaryBullets = () => {
    if (!summaryData) return [];
    const bullets = [];
    const { summary, categoryBreakdown, goalSummary } = summaryData;

    // Bullet 1: Savings & Income
    const savingsPercent = summary.monthlyIncome > 0 ? Math.round((summary.totalSavings / summary.monthlyIncome) * 100) : 0;
    if (summary.totalSavings >= 0) {
      bullets.push(`You saved ${formatCurrency(summary.totalSavings)} this month, representing a ${savingsPercent}% savings rate.`);
    } else {
      bullets.push(`You spent ${formatCurrency(Math.abs(summary.totalSavings))} more than your monthly income this month.`);
    }

    // Bullet 2: MoM Expense change
    const expChange = summary.changes.expenses;
    if (expChange < 0) {
      bullets.push(`Total expenses decreased by ${Math.abs(expChange)}% compared to last month.`);
    } else if (expChange > 0) {
      bullets.push(`Total expenses increased by ${expChange}% compared to last month.`);
    } else {
      bullets.push(`Your spending stayed flat compared to last month.`);
    }

    // Bullet 3: Net Worth / Investments
    bullets.push(`Your net worth stands at ${formatCurrency(summary.netWorth)}, including ${formatCurrency(summary.totalInvestmentValue)} in investment assets.`);

    // Bullet 4: Top Category
    if (categoryBreakdown && categoryBreakdown.length > 0) {
      const sortedCats = [...categoryBreakdown].sort((a, b) => b.spent - a.spent);
      bullets.push(`Your highest spending category was ${sortedCats[0].category} with ${formatCurrency(sortedCats[0].spent)}.`);
    }

    return bullets;
  };

  // Rebuild portfolio trend data
  const portfolioTrendData = (() => {
    if (!investmentPerformance?.holdings?.length) return [];
    const sorted = [...investmentPerformance.holdings].sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
    let runningInvested = 0, runningValue = 0;
    return sorted.map((h) => {
      runningInvested += h.invested;
      runningValue += h.currentValue;
      return {
        name: new Date(h.purchaseDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        Invested: runningInvested,
        'Current Value': runningValue,
      };
    });
  })();

  const bullets = generateSummaryBullets();
  const summary = summaryData?.summary;

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Reports & Statements" />
        <div className="content-body">

          {/* Action Bar */}
          <div className="card mb-md">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="month"
                  className="form-input"
                  style={{ width: '180px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleExportPDF}
                  disabled={exportingPdf || loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileText size={18} />
                  <span>{exportingPdf ? 'Exporting PDF...' : 'Export PDF'}</span>
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleExportExcel}
                  disabled={exportingExcel || loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={18} />
                  <span>{exportingExcel ? 'Exporting Excel...' : 'Export Excel'}</span>
                </button>
              </div>
            </div>
          </div>

          {error && <div className="alert-box alert-box-error">{error}</div>}
          {success && <div className="alert-box alert-box-success">{success}</div>}

          {loading ? (
            <>
              <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card"></div>
                <div className="card metric-card skeleton skeleton-card" style={{ gridColumn: '1 / -1' }}></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="card skeleton skeleton-card" style={{ height: '250px' }}></div>
                <div className="card skeleton skeleton-card" style={{ height: '250px' }}></div>
              </div>
              <div className="charts-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="card chart-card skeleton skeleton-chart"></div>
                <div className="card chart-card skeleton skeleton-chart"></div>
              </div>
              <div className="card chart-card skeleton skeleton-chart" style={{ height: '350px', marginBottom: '1.5rem' }}></div>
            </>
          ) : (
            <>
              {/* Summary Cards */}
              {summary && (
                <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
                  <div className="card metric-card">
                    <div className="metric-header">
                      <span>Monthly Income</span>
                      <div className="metric-icon icon-green"><PiggyBank size={20} /></div>
                    </div>
                    <div className="metric-value">{formatCurrency(summary.monthlyIncome)}</div>
                    <span className="metric-desc">Regular monthly inflows</span>
                  </div>

                  <div className="card metric-card">
                    <div className="metric-header">
                      <span>Total Expenses</span>
                      <div className="metric-icon icon-red"><TrendingDown size={20} /></div>
                    </div>
                    <div className="metric-value">{formatCurrency(summary.totalExpenses)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      {summary.changes.expenses > 0 ? (
                        <span style={{ color: 'var(--accent-red)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                          <ArrowUpRight size={14} /> +{summary.changes.expenses}% vs last month
                        </span>
                      ) : summary.changes.expenses < 0 ? (
                        <span style={{ color: 'var(--accent-green)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                          <ArrowDownRight size={14} /> {summary.changes.expenses}% vs last month
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Flat vs last month</span>
                      )}
                    </div>
                  </div>

                  <div className="card metric-card">
                    <div className="metric-header">
                      <span>Net Savings</span>
                      <div className="metric-icon icon-blue"><TrendingUp size={20} /></div>
                    </div>
                    <div className="metric-value" style={{ color: summary.totalSavings >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {formatCurrency(summary.totalSavings)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      {summary.changes.savings > 0 ? (
                        <span style={{ color: 'var(--accent-green)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                          <ArrowUpRight size={14} /> +{summary.changes.savings}% vs last month
                        </span>
                      ) : summary.changes.savings < 0 ? (
                        <span style={{ color: 'var(--accent-red)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                          <ArrowDownRight size={14} /> {summary.changes.savings}% vs last month
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Flat vs last month</span>
                      )}
                    </div>
                  </div>

                  <div className="card metric-card">
                    <div className="metric-header">
                      <span>Investment Assets</span>
                      <div className="metric-icon icon-orange"><Briefcase size={20} /></div>
                    </div>
                    <div className="metric-value">{formatCurrency(summary.totalInvestmentValue)}</div>
                    <span className="metric-desc">Market value of holdings</span>
                  </div>

                  <div className="card metric-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="metric-header">
                      <span>Net Worth Summary</span>
                      <div className="metric-icon icon-purple"><Target size={20} /></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                      <div className="metric-value" style={{ fontSize: '2rem' }}>{formatCurrency(summary.netWorth)}</div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        (Net Savings + Portfolio Value)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly Summary Bullets & Alerts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Bullets Card */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <FileText size={18} style={{ color: 'var(--accent-green)' }} />
                    <h3 className="chart-title" style={{ margin: 0 }}>Monthly Summary Insights</h3>
                  </div>
                  {bullets.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No summary bullets available.</p>
                  ) : (
                    <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', lineHeight: '1.6' }}>
                      {bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Alerts card */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Bell size={18} style={{ color: 'var(--accent-red)' }} />
                    <h3 className="chart-title" style={{ margin: 0 }}>Recent Alerts</h3>
                  </div>
                  {alerts.length === 0 ? (
                    <div className="empty-state" style={{ padding: '1rem', border: 'none' }}>No recent alerts.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {alerts.map((a) => (
                        <div key={a._id} style={{
                          padding: '8px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                        }}>
                          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                            <AlertTriangle size={12} style={{ color: a.type === 'Budget Alert' ? '#ef4444' : '#f59e0b' }} />
                            {a.title}
                          </div>
                          <div style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Charts Row */}
              <div className="charts-grid" style={{ marginBottom: '1.5rem' }}>
                {/* 6-Month Cash Flow (Reused) */}
                {spendingData?.cashFlowTrend && (
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
                )}

                {/* Expense Breakdown Donut (Reused) */}
                {spendingData?.categoryBreakdown && (
                  <div className="card chart-card">
                    <h3 className="chart-title">Category Breakdown</h3>
                    <div className="chart-container">
                      {spendingData.categoryBreakdown.length === 0 ? (
                        <div className="empty-state" style={{ border: 'none', height: '100%' }}>No expenses.</div>
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
                )}
              </div>

              {/* Portfolio Performance (Reused) */}
              <div className="card chart-card" style={{ height: '350px', marginBottom: '1.5rem' }}>
                <h3 className="chart-title">Portfolio Performance & Allocation</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', height: '280px' }}>
                  {/* Trend chart */}
                  <div style={{ height: '100%' }}>
                    {portfolioTrendData.length < 2 ? (
                      <div className="empty-state" style={{ border: 'none', height: '100%' }}>Add at least 2 holdings to see the trend.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={portfolioTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorCurr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                          <Area type="monotone" dataKey="Invested" stroke="#3b82f6" fillOpacity={1} fill="url(#colorInv)" />
                          <Area type="monotone" dataKey="Current Value" stroke="#10b981" fillOpacity={1} fill="url(#colorCurr)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Asset Allocation Pie */}
                  <div style={{ height: '100%' }}>
                    {allocation.length === 0 ? (
                      <div className="empty-state" style={{ border: 'none', height: '100%' }}>No holdings yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="currentValue">
                            {allocation.map((entry) => (
                              <Cell key={entry.assetType} fill={ASSET_COLORS[entry.assetType] || '#9ca3af'} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '10px' }}
                            formatter={(v, n, p) => [`${formatCurrency(v)} (${p.payload.percentage}%)`, p.payload.assetType]}
                          />
                          <Legend verticalAlign="bottom" iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(Reports);
