/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Match desktop client exactly
        background: '#0a0a0a',
        'background-secondary': '#0e0e0e',
        surface: '#0e0e0e',
        'surface-secondary': '#1c1c1c',
        'surface-hover': 'rgba(255, 255, 255, 0.03)',
        border: 'rgba(255, 255, 255, 0.05)',
        'border-medium': 'rgba(255, 255, 255, 0.1)',
        'border-strong': 'rgba(255, 255, 255, 0.15)',
        primary: '#ffffff',
        'primary-hover': '#e5e5e5',
        muted: '#999999',
        'muted-dark': '#666666',
        foreground: '#d9d9d9',

        // Accent colors from desktop
        'accent-teal': '#06c2b0',
        'accent-green': '#7aff97',
        'accent-red': '#ff7a7a',
        'accent-yellow': '#ffb347',
        'accent-blue': '#339eff',

        // Keep dark scale for compatibility
        dark: {
          50: '#fafafa',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#262626',
          800: '#141414',
          900: '#0a0a0a',
          950: '#000000',
        },
      },
      width: {
        'popup': '360px',
      },
      height: {
        'popup': '600px',
      },
    },
  },
  plugins: [],
}
