/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
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
          light: '#008462', // Primary green for light mode
          dark: '#33ECC9',  // Bright green for dark mode
        },
        // Background colors
        'bg-light': '#F8FCFB', // Soft mint background for light mode
        'bg-dark': '#000000',
        // Surface colors (cards, modals, etc.)
        'surface-light': '#FFFFFF',
        'surface-dark': '#1F2328',
        // Border colors
        'border-light': '#D1E8E2', // Softer teal border for light mode
        'border-dark': '#2D3237',
        // Text colors
        'text-primary-light': '#001E16', // Darker greenish-black for better readability
        'text-primary-dark': '#FFFFFF',
        'text-secondary-light': '#5D706C', // Muted teal for secondary text
        'text-secondary-dark': '#A9ACB0',
        'text-info-light': '#0066CC',
        'text-info-dark': '#66B3FF',
        'text-success-light': '#008462',
        'text-success-dark': '#33ECC9',
        'text-warning-light': '#B45309', // Darker amber for better contrast
        'text-warning-dark': '#FCD34D',
        'text-error-light': '#DC2626',
        'text-error-dark': '#F87171',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}