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
        // Material Design 3 tokens -- Warna Kustom: Pink Muda, Putih, Hijau Army
        // Primary accent: Pink Muda (soft, elegant)
        'primary': '#D4A5A5',
        'on-primary': '#ffffff',
        'primary-container': '#F5DADA',
        'on-primary-container': '#3B1A1A',
        'primary-fixed': '#FFD9D9',
        'primary-fixed-dim': '#F5C4C4',
        'on-primary': '#3B1A1A',
        'on-primary-fixed': '#3B1A1A',
        'on-primary-fixed-variant': '#5A2E2E',
        'inverse-primary': '#FFB3B3',

        // Secondary: Putih / Surface (clean, minimal)
        'secondary': '#4A5A4A',
        'on-secondary': '#ffffff',
        'secondary-container': '#E8EDE8',
        'on-secondary-container': '#0A1A0A',
        'secondary-fixed': '#D4E8D4',
        'secondary-fixed-dim': '#B8D4B8',
        'on-secondary-fixed': '#0A1A0A',
        'on-secondary-fixed-variant': '#1A2E1A',

        // Tertiary: Hijau Army (strong accent)
        'tertiary': '#3D5A3D',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#556B55',
        'on-tertiary-container': '#D4E8C8',
        'tertiary-fixed': '#A8C8A8',
        'tertiary-fixed-dim': '#7BA87B',
        'on-tertiary-fixed': '#0A1A0A',
        'on-tertiary-fixed-variant': '#1A2E1A',

        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // Surface colors (clean white-based)
        'surface': '#FEFEFE',
        'surface-dim': '#D9DED9',
        'surface-bright': '#FEFEFE',
        'surface-variant': '#E4EAE4',
        'surface-tint': '#D4A5A5',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#F5F8F5',
        'surface-container': '#EDF2ED',
        'surface-container-high': '#E2E8E2',
        'surface-container-highest': '#D6DCD6',

        'on-surface': '#121C14',
        'on-surface-variant': '#414943',
        'inverse-surface': '#2E352E',
        'inverse-on-surface': '#F0FFF0',

        'outline': '#717A70',
        'outline-variant': '#C1C9C0',

        'background': '#FEFEFE',
        'on-background': '#121C14',
      },
    },
  },
  plugins: [],
}
