import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { investmentAPI } from '../services/api';
import { formatCurrency, formatCurrencyCompact } from '../utils/formatCurrency';
import {
  Plus, Edit2, Trash2, X, TrendingUp, TrendingDown, Briefcase, BarChart2, Search, RefreshCw
} from 'lucide-react';

const HoldingRow = React.memo(({ holding, assetColors, openEditModal, handleDelete }) => {
  const gain = holding.absoluteReturn >= 0;
  const isLive = holding.priceSource === 'Live';
  const formattedDate = holding.lastPriceUpdate ? new Date(holding.lastPriceUpdate).toLocaleString('en-IN') : 'Never';
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{holding.assetName}</span>
          {isLive ? (
            <span 
              className="category-tag" 
              style={{ 
                backgroundColor: 'rgba(16,185,129,0.12)', 
                color: '#10b981', 
                fontSize: '0.68rem', 
                padding: '2px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'help'
              }}
              title={`Last updated: ${formattedDate}`}
            >
              <RefreshCw size={10} style={{ animation: 'spin 4s linear infinite' }} />
              Live
            </span>
          ) : (
            <span 
              className="category-tag" 
              style={{ 
                backgroundColor: 'var(--bg-secondary)', 
                color: 'var(--text-muted)', 
                fontSize: '0.68rem', 
                padding: '2px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid var(--border-color)'
              }}
            >
              Manual
            </span>
          )}
          {holding.lastPriceError && (
            <span style={{ color: 'var(--accent-red)', cursor: 'help' }} title={`Error: ${holding.lastPriceError}`}>
              ⚠️
            </span>
          )}
        </div>
      </td>
      <td><span className="category-tag" style={{ backgroundColor: `${assetColors[holding.assetType]}22`, color: assetColors[holding.assetType] }}>{holding.assetType}</span></td>
      <td>{holding.quantity}</td>
      <td className="text-right">{formatCurrency(holding.purchasePrice)}</td>
      <td className="text-right">{formatCurrency(holding.currentPrice)}</td>
      <td className="text-right">{formatCurrency(holding.invested)}</td>
      <td className="text-right">{formatCurrency(holding.currentValue)}</td>
      <td className="text-right">
        <div style={{ color: gain ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 600 }}>
          {gain ? '+' : ''}{formatCurrency(holding.absoluteReturn)}
          <div style={{ fontSize: '0.75rem' }}>{gain ? '+' : ''}{holding.percentReturn.toFixed(2)}%</div>
        </div>
      </td>
      <td className="text-right">
        <div className="actions-cell">
          <button className="icon-btn" onClick={() => openEditModal(holding)} title="Edit"><Edit2 size={15} /></button>
          <button className="icon-btn icon-btn-danger" onClick={() => handleDelete(holding._id)} title="Delete"><Trash2 size={15} /></button>
        </div>
      </td>
    </tr>
  );
});
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const ASSET_COLORS = {
  'Stock':       '#3b82f6',
  'Mutual Fund': '#8b5cf6',
  'ETF':         '#f59e0b',
  'Bond':        '#10b981',
  'Gold':        '#f97316',
  'Cash':        '#6b7280',
  'Other':       '#ec4899',
};

const ASSET_TYPES = ['Stock', 'Mutual Fund', 'ETF', 'Bond', 'Gold', 'Cash', 'Other'];

const Investments = () => {
  const [performance, setPerformance] = useState(null);
  const [allocation, setAllocation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalError, setModalError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState({ hasGoldApiKey: false });

  // Search autocomplete inside Modal
  const [mfSchemeCode, setMfSchemeCode] = useState('');
  const [stockTicker, setStockTicker] = useState('');
  const [searchQueryModal, setSearchQueryModal] = useState('');
  const [searchResultsModal, setSearchResultsModal] = useState([]);
  const [searchingModal, setSearchingModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Form state
  const [assetType, setAssetType] = useState('Stock');
  const [assetName, setAssetName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().substring(0, 10));

  // Handle asset type change
  const handleAssetTypeChange = (e) => {
    setAssetType(e.target.value);
    setSearchQueryModal('');
    setSearchResultsModal([]);
    setMfSchemeCode('');
    setStockTicker('');
    setShowDropdown(false);
    setCurrentPrice('');
  };

  // Debounce query search in modal
  useEffect(() => {
    let active = true;
    if (!searchQueryModal || searchQueryModal.length < 2) {
      setSearchResultsModal([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setSearchingModal(true);
      try {
        let res;
        if (assetType === 'Mutual Fund') {
          res = await investmentAPI.searchMutualFunds(searchQueryModal);
        } else if (assetType === 'Stock' || assetType === 'ETF') {
          res = await investmentAPI.searchStocks(searchQueryModal, assetType);
        }
        if (active && res && res.data.success) {
          setSearchResultsModal(res.data.data);
          setShowDropdown(true);
        }
      } catch (err) {
        if (active) console.error('Modal search error:', err);
      } finally {
        if (active) setSearchingModal(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(delayDebounce);
    };
  }, [searchQueryModal, assetType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch config
      const confRes = await investmentAPI.getConfig();
      if (confRes.data.success) setConfig(confRes.data.data);

      // Fetch existing data immediately for fast render
      const [perfRes, allocRes] = await Promise.all([
        investmentAPI.getPerformance(),
        investmentAPI.getAllocation(),
      ]);
      if (perfRes.data.success) setPerformance(perfRes.data.data);
      if (allocRes.data.success) setAllocation(allocRes.data.data);
      
      setLoading(false); // render immediately!

      // Auto-refresh prices in background, then silently update UI
      investmentAPI.refreshPrices().then(() => {
        Promise.all([
          investmentAPI.getPerformance(),
          investmentAPI.getAllocation(),
        ]).then(([newPerf, newAlloc]) => {
          if (newPerf.data.success) setPerformance(newPerf.data.data);
          if (newAlloc.data.success) setAllocation(newAlloc.data.data);
        }).catch(err => console.error('Failed to update UI after background refresh:', err));
      }).catch(err => {
        console.error('Auto-refresh prices failed:', err);
      });
      
    } catch (err) {
      setError('Error loading investment data');
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    setSuccess('');
    setError('');
    try {
      const res = await investmentAPI.refreshPrices();
      if (res.data.success) {
        const summary = res.data.data; // { total, successes, failures, details }
        if (summary.failures > 0) {
          setError(`Refreshed with ${summary.failures} errors. Check badges.`);
        } else {
          setSuccess('Live prices updated successfully!');
        }
        fetchData();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error refreshing prices');
    } finally {
      setRefreshing(false);
    }
  };

  const openAddModal = () => {
    setEditId(null); setAssetType('Stock'); setAssetName(''); setQuantity('');
    setPurchasePrice(''); setCurrentPrice('');
    setPurchaseDate(new Date().toISOString().substring(0, 10));
    setMfSchemeCode(''); setStockTicker(''); setSearchQueryModal('');
    setModalError(''); setShowDropdown(false); setShowModal(true);
  };

  const openEditModal = useCallback((holding) => {
    setEditId(holding._id); setAssetType(holding.assetType); setAssetName(holding.assetName);
    setQuantity(holding.quantity.toString()); setPurchasePrice(holding.purchasePrice.toString());
    setCurrentPrice(holding.currentPrice.toString());
    setPurchaseDate(new Date(holding.purchaseDate).toISOString().substring(0, 10));
    setMfSchemeCode(holding.mfSchemeCode || '');
    setStockTicker(holding.stockTicker || '');
    setSearchQueryModal(holding.assetName);
    setModalError(''); setShowDropdown(false); setShowModal(true);
  }, []);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Remove this investment?')) return;
    try {
      await investmentAPI.deleteInvestment(id);
      setSuccess('Investment removed'); fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Error deleting investment'); }
  }, [performance]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setModalError('');
    const isLive = assetType === 'Stock' || assetType === 'ETF' || assetType === 'Mutual Fund' || (assetType === 'Gold' && config.hasGoldApiKey);
    if (!assetName || !quantity || !purchasePrice || (!isLive && !currentPrice) || !purchaseDate) {
      return setModalError('Please fill in all required fields');
    }
    const payload = { 
      assetType, 
      assetName, 
      quantity: Number(quantity), 
      purchasePrice: Number(purchasePrice), 
      currentPrice: isLive ? undefined : Number(currentPrice), 
      purchaseDate,
      mfSchemeCode: assetType === 'Mutual Fund' ? mfSchemeCode : undefined,
      stockTicker: (assetType === 'Stock' || assetType === 'ETF') ? stockTicker : undefined,
    };
    try {
      if (editId) await investmentAPI.updateInvestment(editId, payload);
      else await investmentAPI.addInvestment(payload);
      setShowModal(false); fetchData();
      setSuccess(editId ? 'Investment updated!' : 'Investment added!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Error saving investment');
    }
  };

  // Build trend data points from holdings sorted by purchase date
  const trendData = (() => {
    if (!performance?.holdings?.length) return [];
    const sorted = [...performance.holdings].sort((a, b) => new Date(a.purchaseDate) - new Date(b.purchaseDate));
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

  const summary = performance?.summary;
  const holdings = performance?.holdings || [];
  const isGain = (summary?.overallAbsoluteReturn || 0) >= 0;

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Header title="Investments" />
        <div className="content-body">

          {error && <div className="alert-box alert-box-error">{error}</div>}
          {success && <div className="alert-box alert-box-success">{success}</div>}

          {/* Summary Cards */}
          {summary && (
            <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="card metric-card">
                <div className="metric-header"><span>Total Invested</span>
                  <div className="metric-icon icon-blue"><Briefcase size={20} /></div>
                </div>
                <div className="metric-value">{formatCurrency(summary.totalInvested)}</div>
                <span className="metric-desc">Across {holdings.length} holdings</span>
              </div>
              <div className="card metric-card">
                <div className="metric-header"><span>Current Value</span>
                  <div className="metric-icon icon-green"><TrendingUp size={20} /></div>
                </div>
                <div className="metric-value">{formatCurrency(summary.totalCurrentValue)}</div>
                <span className="metric-desc">Live market value</span>
              </div>
              <div className="card metric-card">
                <div className="metric-header"><span>Overall Returns</span>
                  <div className={`metric-icon ${isGain ? 'icon-green' : 'icon-red'}`}>
                    {isGain ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                </div>
                <div className="metric-value" style={{ color: isGain ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {isGain ? '+' : ''}{formatCurrency(summary.overallAbsoluteReturn)}
                </div>
                <span className="metric-desc" style={{ color: isGain ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {isGain ? '▲' : '▼'} {Math.abs(summary.overallPercentReturn).toFixed(2)}% overall
                </span>
              </div>
              <div className="card metric-card">
                <div className="metric-header"><span>Return %</span>
                  <div className="metric-icon icon-orange"><BarChart2 size={20} /></div>
                </div>
                <div className="metric-value" style={{ color: isGain ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {isGain ? '+' : ''}{summary.overallPercentReturn.toFixed(2)}%
                </div>
                <span className="metric-desc">XIRR approximation</span>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="charts-grid" style={{ marginBottom: '1.5rem' }}>
            {/* Portfolio Trend */}
            <div className="card chart-card">
              <h3 className="chart-title">Portfolio Growth</h3>
              <div className="chart-container">
                {trendData.length < 2 ? (
                  <div className="empty-state" style={{ border: 'none', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    Add at least 2 holdings to see the trend.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}
                        formatter={(v) => formatCurrency(v)}
                      />
                      <Legend verticalAlign="top" height={36} />
                      <Area type="monotone" dataKey="Invested" stroke="#3b82f6" fillOpacity={1} fill="url(#colorInv)" />
                      <Area type="monotone" dataKey="Current Value" stroke="#10b981" fillOpacity={1} fill="url(#colorCurr)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Asset Allocation Donut */}
            <div className="card chart-card">
              <h3 className="chart-title">Asset Allocation</h3>
              <div className="chart-container">
                {allocation.length === 0 ? (
                  <div className="empty-state" style={{ border: 'none', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    No holdings yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocation} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="currentValue">
                        {allocation.map((entry) => (
                          <Cell key={entry.assetType} fill={ASSET_COLORS[entry.assetType] || '#9ca3af'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-md)' }}
                        formatter={(v, n, p) => [`${formatCurrency(v)} (${p.payload.percentage}%)`, p.payload.assetType]}
                      />
                      <Legend verticalAlign="bottom" iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Holdings Table */}
          {(() => {
            const filteredHoldings = holdings.filter((h) =>
              h.assetName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
            );

            return (
              <div className="card table-card">
                <div className="table-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h3 className="chart-title" style={{ margin: 0 }}>Holdings</h3>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: '220px', padding: '0.4rem 0.75rem 0.4rem 2rem', fontSize: '0.8rem' }}
                        placeholder="Search asset name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', height: '36px' }} 
                      onClick={handleRefreshPrices}
                      disabled={refreshing}
                    >
                      <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                      {refreshing ? "Refreshing..." : "Refresh Prices"}
                    </button>
                    <button className="btn btn-primary" onClick={openAddModal}>
                      <Plus size={18} /> Add Holding
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state">Loading investments...</div>
                ) : filteredHoldings.length === 0 ? (
                  <div className="empty-state">
                    <p>No investments found.</p>
                    <button className="btn btn-secondary mt-md" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }} onClick={openAddModal}>
                      Add First Holding
                    </button>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Instrument</th><th>Type</th><th>Qty</th>
                          <th className="text-right">Buy Price</th>
                          <th className="text-right">Curr. Price</th>
                          <th className="text-right">Invested</th>
                          <th className="text-right">Curr. Value</th>
                          <th className="text-right">P&L</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHoldings.map((h) => (
                          <HoldingRow
                            key={h._id}
                            holding={h}
                            assetColors={ASSET_COLORS}
                            openEditModal={openEditModal}
                            handleDelete={handleDelete}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editId ? 'Edit Holding' : 'Add New Holding'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            {modalError && <div className="alert-box alert-box-error">{modalError}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1', position: 'relative' }}>
                  <label className="form-label">{assetType === 'Stock' || assetType === 'ETF' || assetType === 'Mutual Fund' ? 'Search Asset *' : 'Asset Name *'}</label>
                  {assetType === 'Stock' || assetType === 'ETF' || assetType === 'Mutual Fund' ? (
                    <>
                      <input
                        type="text"
                        className="form-input"
                        value={searchQueryModal}
                        onChange={(e) => {
                          setSearchQueryModal(e.target.value);
                          setAssetName(e.target.value);
                          setShowDropdown(true);
                          setStockTicker('');
                          setMfSchemeCode('');
                          setCurrentPrice('');
                        }}
                        placeholder={assetType === 'Stock' || assetType === 'ETF' ? 'e.g. RELIANCE, TCS...' : 'e.g. HDFC Bluechip, SBI...'}
                        required
                      />
                      {searchingModal && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Searching...</div>}
                      {showDropdown && searchResultsModal.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          zIndex: 10,
                          maxHeight: '180px',
                          overflowY: 'auto',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          marginTop: '4px'
                        }}>
                          {searchResultsModal.map((item) => {
                            const isMF = assetType === 'Mutual Fund';
                            const name = isMF ? item.schemeName : item.name;
                            const ticker = isMF ? item.schemeCode : item.ticker;
                            return (
                              <div
                                key={ticker}
                                onClick={async () => {
                                  setAssetName(name);
                                  setSearchQueryModal(name);
                                  if (isMF) {
                                    setMfSchemeCode(ticker.toString());
                                    setStockTicker('');
                                  } else {
                                    setStockTicker(ticker);
                                    setMfSchemeCode('');
                                  }
                                  setShowDropdown(false);
                                  
                                  setFetchingPrice(true);
                                  try {
                                    const res = await investmentAPI.getLivePrice(assetType, ticker.toString());
                                    if (res.data && res.data.success && res.data.data) {
                                      setCurrentPrice(res.data.data.price.toString());
                                    }
                                  } catch (err) {
                                    console.error('Error fetching live price', err);
                                  } finally {
                                    setFetchingPrice(false);
                                  }
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  borderBottom: '1px solid var(--border-color)',
                                }}
                                className="search-result-item"
                              >
                                <strong>{ticker}</strong> - {name}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <input type="text" className="form-input" value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Sovereign Gold Bond" required />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Type *</label>
                  <select className="form-select" value={assetType} onChange={handleAssetTypeChange}>
                    {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input type="number" className="form-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 10" min="0" step="0.001" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Price (₹) *</label>
                  <input type="number" className="form-input" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="Price per unit" min="0" step="0.01" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Price (₹) *</label>
                  {(() => {
                    const requiresTicker = assetType === 'Stock' || assetType === 'ETF' || assetType === 'Mutual Fund';
                    const hasTicker = !!(stockTicker || mfSchemeCode);
                    const isLive = hasTicker || (assetType === 'Gold' && config.hasGoldApiKey);

                    if (requiresTicker && !hasTicker) {
                      return (
                        <div style={{ position: 'relative', padding: '0.7rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-orange)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>Awaiting Selection</span>
                          <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Please select a valid asset from the search dropdown.</div>
                        </div>
                      );
                    }

                    return isLive ? (
                    <div style={{ position: 'relative', padding: '0.7rem 1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{fetchingPrice ? 'Fetching Live Price...' : 'Auto-synced Live Pricing'}</span>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Latest price will be fetched upon saving</div>
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        className="form-input"
                        value={currentPrice}
                        onChange={(e) => setCurrentPrice(e.target.value)}
                        placeholder="Latest price per unit"
                        min="0"
                        step="0.01"
                        required
                      />
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Manual pricing for this asset type
                      </div>
                    </>
                  );
                  })()}
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Purchase Date *</label>
                  <input type="date" className="form-input" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} required />
                </div>
              </div>
              {/* Live preview */}
              {quantity && purchasePrice && (currentPrice || stockTicker || mfSchemeCode || (assetType === 'Gold' && config.hasGoldApiKey)) && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Invested: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(Number(quantity) * Number(purchasePrice))}</strong>
                  {(currentPrice && !stockTicker && !mfSchemeCode && !(assetType === 'Gold' && config.hasGoldApiKey)) && (
                    <>
                      &nbsp;→ Current: <strong style={{ color: (Number(quantity) * Number(currentPrice)) >= (Number(quantity) * Number(purchasePrice)) ? 'var(--accent-green)' : 'var(--accent-red)' }}>{formatCurrency(Number(quantity) * Number(currentPrice))}</strong>
                    </>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={(assetType === 'Stock' || assetType === 'ETF' || assetType === 'Mutual Fund') && !(stockTicker || mfSchemeCode)}>
                  {editId ? 'Save Changes' : 'Add Holding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
