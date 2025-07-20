/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ZetaChain Brand Colors
        zeta: {
          50: '#E6FDF8',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#66F1D6',
          400: '#33ECC9',
          500: '#008462', // Primary green
          600: '#006E4C', // Dark green
          700: '#005A3F',
          800: '#004633',
          900: '#003326',
        },
        // ZetaChain UI Colors
        'zeta-accent': {
          light: '#99F36F', // Light green accent
          dark: '#006E4C',  // Dark green accent
        },
        // Background colors
        background: {
          light: '#FFFFFF',
          dark: '#000000',
        },
        // Surface colors (cards, modals, etc.)
        surface: {
          light: '#FFFFFF',
          dark: '#1F2328',
        },
        // Border colors
        border: {
          light: '#E5E8EC',
          dark: '#2D3237',
        },
        // Text colors
        text: {
          primary: {
            light: '#000000',
            dark: '#FFFFFF',
          },
          secondary: {
            light: '#6B7280',
            dark: '#A9ACB0',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}