export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- WAJIB: Agar tombol dark mode berfungsi
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      colors: {
        // Material Design 3 tokens
        'primary': '#0d631b',
        'on-primary': '#ffffff',
        'primary-container': '#2e7d32',
        'on-primary-container': '#cbffc2',
        'primary-fixed': '#a3f69c',
        'primary-fixed-dim': '#88d982',
        'on-primary-fixed': '#002204',
        'on-primary-fixed-variant': '#005312',
        'inverse-primary': '#88d982',

        'secondary': '#006c4a',
        'on-secondary': '#ffffff',
        'secondary-container': '#82f5c1',
        'on-secondary-container': '#00714e',
        'secondary-fixed': '#85f8c4',
        'secondary-fixed-dim': '#68dba9',
        'on-secondary-fixed': '#002114',
        'on-secondary-fixed-variant': '#005137',

        'tertiary': '#794b00',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#9a6100',
        'on-tertiary-container': '#ffeedf',
        'tertiary-fixed': '#ffddb8',
        'tertiary-fixed-dim': '#ffb95f',
        'on-tertiary-fixed': '#2a1700',
        'on-tertiary-fixed-variant': '#653e00',

        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        'surface': '#f8f9ff',
        'surface-dim': '#d1dbec',
        'surface-bright': '#f8f9ff',
        'surface-variant': '#d9e3f4',
        'surface-tint': '#1b6d24',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eef4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dfe9fa',
        'surface-container-highest': '#d9e3f4',

        'on-surface': '#121c28',
        'on-surface-variant': '#40493d',
        'inverse-surface': '#27313e',
        'inverse-on-surface': '#eaf1ff',

        'outline': '#707a6c',
        'outline-variant': '#bfcaba',

        'background': '#f8f9ff',
        'on-background': '#121c28',
      },
    },
  },
  plugins: [],
}
