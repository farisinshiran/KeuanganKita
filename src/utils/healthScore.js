/**
 * Financial Health Score (0–100)
 *
 * Four equally-weighted pillars (25 pts each):
 *  1. Savings Rate       — (income − expense) / income ≥ 20%
 *  2. Budget Adherence   — % of budget categories not over-spent
 *  3. Debt Ratio         — CC utilisation ≤ 30%
 *  4. Investment Coverage — investments / total assets ≥ 20%
 */

/**
 * @param {object} summary       – { income, expense, balance, ccDebt, investment, netWorth, walletBalances }
 * @param {Array}  transactions  – all transactions (Date objects already parsed)
 * @param {object} categories    – { raw: [{id, name, type, budget}] }
 * @returns {{ score: number, breakdown: Array }}
 */
export function calculateHealthScore(summary, transactions, categories) {
  const now = new Date();
  const m   = now.getMonth();
  const y   = now.getFullYear();

  const monthTx = (transactions || []).filter(
    t => t.date && t.date.getMonth() === m && t.date.getFullYear() === y,
  );
  const monthIncome  = monthTx.filter(t => t.type === 'income') .reduce((a, t) => a + Number(t.amount), 0);
  const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  // ── 1. Savings Rate ────────────────────────────────────── max 25 pts
  let savingsScore = 0;
  let savingsDetail = 'Tidak ada pemasukan bulan ini';
  if (monthIncome > 0) {
    const rate = Math.max(0, (monthIncome - monthExpense) / monthIncome);
    savingsScore   = Math.min(25, (rate / 0.20) * 25);
    savingsDetail  = `${(rate * 100).toFixed(1)}% tabungan bulan ini (target ≥20%)`;
  }

  // ── 2. Budget Adherence ────────────────────────────────── max 25 pts
  const budgetCats = (categories?.raw || []).filter(c => c.type === 'expense' && c.budget > 0);
  let adherenceScore  = 25;
  let adherenceDetail = 'Belum ada budget kategori';
  if (budgetCats.length > 0) {
    const spending = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      spending[t.category] = (spending[t.category] || 0) + Number(t.amount);
    });
    const within       = budgetCats.filter(c => (spending[c.name] || 0) <= c.budget).length;
    adherenceScore  = (within / budgetCats.length) * 25;
    adherenceDetail = `${within}/${budgetCats.length} kategori dalam budget`;
  }

  // ── 3. Debt Ratio ──────────────────────────────────────── max 25 pts
  // utilisation ≤30% → 25pts; ≥90% → 0pts; linear between
  const ccWallets = (summary?.walletBalances || []).filter(w => w.type === 'credit_card' && w.limit > 0);
  let debtScore  = 25;
  let debtDetail = 'Tidak ada kartu kredit';
  if (ccWallets.length > 0) {
    const totalDebt  = ccWallets.reduce((a, w) => a + Math.abs(w.currentBalance), 0);
    const totalLimit = ccWallets.reduce((a, w) => a + w.limit, 0);
    const util = totalLimit > 0 ? totalDebt / totalLimit : 0;
    debtScore  = util <= 0.30 ? 25 : util >= 0.90 ? 0 : ((0.90 - util) / 0.60) * 25;
    debtDetail = `Utilisasi CC ${(util * 100).toFixed(1)}% (target ≤30%)`;
  }

  // ── 4. Investment Coverage ─────────────────────────────── max 25 pts
  const totalInv    = summary?.investment || 0;
  const liquidTotal = (summary?.walletBalances || [])
    .filter(w => w.type !== 'credit_card')
    .reduce((a, w) => a + w.currentBalance, 0);
  const totalAssets = liquidTotal + totalInv;
  let investScore  = 0;
  let investDetail = 'Belum ada investasi';
  if (totalAssets > 0 && totalInv > 0) {
    const ratio    = totalInv / totalAssets;
    investScore    = Math.min(25, (ratio / 0.20) * 25);
    investDetail   = `${(ratio * 100).toFixed(1)}% dari total aset (target ≥20%)`;
  }

  const score = Math.round(
    Math.max(0, Math.min(100, savingsScore + adherenceScore + debtScore + investScore)),
  );

  return {
    score,
    breakdown: [
      { key: 'savings',    label: 'Tingkat Tabungan', score: Math.round(savingsScore),    max: 25, detail: savingsDetail  },
      { key: 'budget',     label: 'Disiplin Budget',  score: Math.round(adherenceScore),  max: 25, detail: adherenceDetail },
      { key: 'debt',       label: 'Rasio Utang CC',   score: Math.round(debtScore),       max: 25, detail: debtDetail      },
      { key: 'investment', label: 'Porsi Investasi',  score: Math.round(investScore),     max: 25, detail: investDetail    },
    ],
  };
}

export function getScoreStatus(score) {
  if (score >= 80) return { label: 'Sangat Baik',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', barColor: 'bg-emerald-500', ringColor: '#10B981' };
  if (score >= 60) return { label: 'Baik',            color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20',       border: 'border-blue-200 dark:border-blue-800',    barColor: 'bg-blue-500',     ringColor: '#3B82F6' };
  if (score >= 40) return { label: 'Cukup',           color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-800',  barColor: 'bg-amber-500',    ringColor: '#F59E0B' };
  return            { label: 'Perlu Perhatian',       color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-800',      barColor: 'bg-red-500',      ringColor: '#EF4444' };
}
