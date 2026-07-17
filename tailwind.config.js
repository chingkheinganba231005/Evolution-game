/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Futuristic biological-lab palette (colour-blind-aware accents)
        graphite: {
          950: '#0a0c10',
          900: '#0e1117',
          850: '#12161f',
          800: '#161b26',
          700: '#1e2531',
          600: '#2a3341',
          500: '#3a4557',
        },
        specimen: {
          DEFAULT: '#4fd1c5',
          bright: '#5eead4',
          deep: '#0d9488',
        },
        signal: {
          blue: '#60a5fa',
          amber: '#fbbf24',
          rose: '#fb7185',
          violet: '#a78bfa',
          lime: '#a3e635',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px -12px rgba(0,0,0,0.6)',
        glow: '0 0 20px -4px rgba(79,209,197,0.5)',
      },
      backgroundImage: {
        'grid-fine':
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
