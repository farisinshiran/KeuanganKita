// Utility Functions - Formatters

/**
 * Format number to Indonesian Rupiah currency
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    minimumFractionDigits: 0 
  }).format(num);
};

/**
 * Format date to Indonesian medium format
 * @param {Date|number|string} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date || typeof date.getTime !== 'function' || isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
};

/**
 * Format date for input fields (YYYY-MM-DD)
 * @param {Date|number|string} date - The date to format
 * @returns {string} ISO date string
 */
export const formatDateInput = (date) => {
  if (!date || typeof date.toISOString !== 'function') return new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0];
};

/**
 * Parse various date formats to JavaScript Date
 * @param {Date|number|string|FirestoreTimestamp} val - The value to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export const parseDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val; // JS Date Object
  const d = new Date(val); // String / Number
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Format currency with privacy mode
 * @param {number|string} val - The amount
 * @param {boolean} privacyMode - Whether to hide actual amount
 * @returns {string} Formatted or masked currency
 */
export const formatCurrencyPrivacy = (val, privacyMode = false) => {
  if (privacyMode) return 'Rp ••••••';
  return formatCurrency(val);
};
