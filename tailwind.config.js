/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#1e1e1e',
          secondary: '#161616',
          card: '#262626',
          hover: '#2e2e2e',
          active: '#333333',
          code: '#181818',
        },
        border: {
          subtle: '#2e2e2e',
          light: '#383838',
        },
        accent: {
          purple: '#7b6cd9',
          purpleHover: '#8d80e0',
          blue: '#4a90e2',
          orange: '#e6963c',
          green: '#56b075',
          red: '#e05353',
        },
        text: {
          primary: '#dcddde',
          muted: '#999999',
          faint: '#666666',
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
