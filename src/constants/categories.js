// Default Categories Constants

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Belanja Bulanan',
  'Makan Luar',
  'Transportasi',
  'Listrik & Air',
  'Pulsa & Internet',
  'Zakat & Infaq',
  'Pendidikan (SPP)',
  'Cicilan Rumah',
  'Kesehatan',
  'Langganan'
];

export const DEFAULT_INCOME_CATEGORIES = [
  'Gaji Pokok',
  'Bonus/THR',
  'Sampingan',
  'Dividen'
];

export const DEFAULT_INVESTMENT_TYPES = [
  { name: 'Emas (Logam Mulia)', target: 100000000, deadline: null, icon: '🥇' },
  { name: 'Saham Bluechip', target: 500000000, deadline: null, icon: '📊' },
  { name: 'Reksadana Pasar Uang', target: 50000000, deadline: null, icon: '📈' }
];

export const DEFAULT_WALLETS = [
  { name: 'Dompet Tunai', type: 'cash', initialBalance: 0, limit: 0, icon: '💵' },
  { name: 'Bank BCA', type: 'bank', initialBalance: 0, limit: 0, icon: '🏦' },
  { name: 'Kartu Kredit Mandiri', type: 'credit_card', initialBalance: 0, limit: 10000000, icon: '💳' }
];
