/**
 * Formats a number as Indian Rupees using the en-IN locale.
 * Examples: 1250 → ₹1,250 | 125000 → ₹1,25,000
 * @param {number} amount
 * @returns {string}
 */
export const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

/**
 * Compact currency formatter for chart axes (e.g. ₹1.2L, ₹50K)
 * @param {number} amount
 * @returns {string}
 */
export const formatCurrencyCompact = (amount) => {
  const num = Number(amount) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
  return `₹${num}`;
};
