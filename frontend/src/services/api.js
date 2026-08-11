import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth endpoints
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, passwordData) => api.post(`/auth/reset-password/${token}`, passwordData),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

// Expense endpoints
export const expenseAPI = {
  addExpense: (expenseData) => api.post('/expenses', expenseData),
  getExpenses: (filters) => api.get('/expenses', { params: filters }),
  updateExpense: (id, expenseData) => api.put(`/expenses/${id}`, expenseData),
  deleteExpense: (id) => api.delete(`/expenses/${id}`),
  getPaymentBreakdown: (month, scope = 'personal') => api.get('/expenses/payment-breakdown', { params: { month, scope } }),
};

// Budget endpoints
export const budgetAPI = {
  setBudget: (data) => api.post('/budgets', data),
  getBudgets: (month, scope = 'personal') => api.get(`/budgets?month=${month}&scope=${scope}`),
  getUtilization: (month, scope = 'personal') => api.get(`/budgets/utilization?month=${month}&scope=${scope}`),
};

// Investment endpoints
export const investmentAPI = {
  addInvestment: (data) => api.post('/investments', data),
  getInvestments: () => api.get('/investments'),
  updateInvestment: (id, data) => api.put(`/investments/${id}`, data),
  deleteInvestment: (id) => api.delete(`/investments/${id}`),
  getAllocation: () => api.get('/investments/allocation'),
  getPerformance: () => api.get('/investments/performance'),
  searchMutualFunds: (query) => api.get('/investments/mf-search', { params: { query } }),
  searchStocks: (query, assetType) => api.get(`/investments/stock-search?query=${query}&assetType=${assetType || 'Stock'}`),
  refreshPrices: () => api.post('/investments/refresh-prices'),
  getLivePrice: (assetType, ticker) => api.get(`/investments/live-price?assetType=${assetType}&ticker=${ticker}`),
  getConfig: () => api.get('/investments/config'),
};

// Recurring Expense endpoints
export const recurringExpenseAPI = {
  createRule: (data) => api.post('/recurring-expenses', data),
  getRules: () => api.get('/recurring-expenses'),
  updateRule: (id, data) => api.put(`/recurring-expenses/${id}`, data),
  deleteRule: (id) => api.delete(`/recurring-expenses/${id}`),
  runCheck: () => api.post('/recurring-expenses/run-check'),
};

// Goals endpoints
export const goalsAPI = {
  createGoal: (data) => api.post('/goals', data),
  getGoals: (scope = 'personal') => api.get(`/goals?scope=${scope}`),
  updateGoal: (id, data) => api.put(`/goals/${id}`, data),
  deleteGoal: (id) => api.delete(`/goals/${id}`),
  getGoalProgress: (id) => api.get(`/goals/${id}/progress`),
};

// Audit Logs endpoints
export const auditAPI = {
  getLogs: (resourceType = '', limit = 50) => api.get('/audit-logs', { params: { resourceType, limit } }),
};

// Household endpoints
export const householdAPI = {
  getHousehold: () => api.get('/households/me'),
  createHousehold: (data) => api.post('/households', data),
  joinHousehold: (data) => api.post('/households/join', data),
  markBudgetShared: (id) => api.put(`/households/${id}/budget`),
  leaveHousehold: (id) => api.delete(`/households/${id}/leave`),
  removeMember: (id, userId) => api.delete(`/households/${id}/members/${userId}`),
};

// Analytics endpoints
export const analyticsAPI = {
  getSpendingAnalysis: (month) => api.get('/analytics/spending-analysis', { params: { month } }),
  getRecommendations: () => api.get('/analytics/recommendations'),
  getHealthScore: () => api.get('/analytics/health-score'),
  getTrendsPredictions: () => api.get('/analytics/trends-predictions'),
};

// Notifications endpoints
export const notificationsAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  generateSummary: () => api.post('/notifications/generate-summary'),
};

// Reports endpoints
export const reportsAPI = {
  getMonthlySummary: (month) => api.get('/reports/monthly-summary', { params: { month } }),
  exportPDF: (month) => api.get('/reports/export/pdf', { params: { month }, responseType: 'blob' }),
  exportExcel: (month) => api.get('/reports/export/excel', { params: { month }, responseType: 'blob' }),
};

export default api;
