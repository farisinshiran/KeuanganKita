// Service Icons Constants

export const SERVICE_ICONS = {
  netflix: '🎬', 'netflix premium': '🎬',
  spotify: '🎵', 'spotify premium': '🎵',
  youtube: '📺', 'youtube premium': '📺',
  disney: '🎭', 'disney+': '🎭',
  apple: '🍎', 'apple tv': '🍎', 'apple music': '🎶',
  hbo: '📺', 'hbo max': '📺',
  prime: '📦', 'amazon prime': '📦',
  canva: '🎨',
  figma: '🎨',
  github: '💻', 'github pro': '💻',
  slack: '💬',
  notion: '📝',
  adobe: '🖼️', 'creative cloud': '🖼️',
  dropbox: '☁️',
  onedrive: '☁️',
  icloud: '☁️',
  google: '🔍', 'google drive': '☁️', 'google one': '☁️',
  microsoft: '💻', 'office 365': '💻',
  zoom: '📹',
  telegram: '✈️', 'telegram premium': '✈️',
  whatsapp: '💬',
  duolingo: '🦉',
  udemy: '🎓',
  coursera: '🎓',
  linkedin: '💼',
  chatgpt: '🤖',
  grammarly: '✍️',
  nordvpn: '🔒',
  plex: '🎬',
  tidal: '🎵',
  deezer: '🎵',
  lastpass: '🔐', 'password': '🔐',
  evernote: '📓',
  todoist: '✅',
  trello: '📋',
  asana: '📋',
  miro: '🎨',
  photoshop: '🖼️',
  lightroom: '📷',
  illustrator: '🎨',
  indesign: '📄',
  audible: '🎧',
  skillshare: '🎓',
  masterclass: '🎓',
  funimation: '🎭',
  crunchyroll: '🎭',
  showtime: '📺',
  cinemax: '📺',
  starz: '📺',
  paramount: '📺',
  peacock: '📺',
  vpn: '🔒',
  wix: '🌐',
  squarespace: '🌐',
  hosting: '🌐',
  domain: '🌐',
  email: '📧',
  mailchimp: '📧',
  sendgrid: '📧',
  stripe: '💳',
  paypal: '💳',
  wise: '💰',
  revolut: '💳',
  twitch: '🎮',
  gamepass: '🎮', 'xbox': '🎮',
  playstation: '🎮', 'ps plus': '🎮',
  nintendo: '🎮', 'switch': '🎮',
  steam: '🎮',
  epic: '🎮',
  origin: '🎮',
  ubisoft: '🎮',
  elden: '🎮',
  roblox: '🎮',
  // Untuk kategori umum
  'listrik': '⚡', 'gas': '🔥', 'air': '💧', 'internet': '📡', 'pulsa': '📱',
  'tagihan': '📄', 'cicilan': '💰', 'asuransi': '🛡️', 'kesehatan': '⚕️',
  'gym': '💪', 'olahraga': '⚽', 'kendaraan': '🚗', 'rumah': '🏠',
  'sekolah': '🏫', 'kursus': '📚', 'langganan': '🔔'
};

/**
 * Get icon for a subscription service by name
 * @param {string} name - Service name
 * @returns {string} Emoji icon
 */
export const getSubscriptionIcon = (name) => {
  if (!name) return '🔔';
  const lowerName = name.toLowerCase();

  // Direct match
  if (SERVICE_ICONS[lowerName]) return SERVICE_ICONS[lowerName];

  // Partial match - check if name contains any key
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lowerName.includes(key)) return icon;
  }

  // Default icon
  return '🔔';
};
