/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

export default {
  // Enable dark mode via a 'dark' class on the html tag.
  darkMode: 'class',

  // Files to scan for Tailwind classes.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      // Add system fonts for a native feel.
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },

      // Define a rich color palette for the application.
      colors: {
        // Custom dark theme colors
        dark: {
          bg: '#0D1117',        // Main background
          'bg-secondary': '#161B22', // Secondary background (sidebars)
          card: '#111827',       // Card background
          border: '#30363d',     // Borders and dividers
          hover: '#1f2937',      // Hover states
          text: '#c9d1d9',       // Primary text
          'text-secondary': '#8b949e', // Secondary text
        },
        // Primary brand color
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Semantic colors for UI states
        success: '#22c55e',
        warning: '#f97316',
        danger: '#ef4444',
        info: '#3b82f6',
      },

      // Custom animations for a dynamic UI.
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'gradient': 'gradient 15s ease infinite',
        'spin-slow': 'spin 3s linear infinite',
      },

      // Keyframes for the custom animations.
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },

      // Additional utilities.
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.3)',
        'glow-md': '0 0 20px rgba(59, 130, 246, 0.4)',
        'glow-lg': '0 0 30px rgba(59, 130, 246, 0.5)',
      },
    },
  },

  // Add plugins for enhanced functionality.
  plugins: [
    // Provides beautiful default styling for form elements.
    require('@tailwindcss/forms'),
    // Adds the 'prose' class for styling markdown/HTML content.
    require('@tailwindcss/typography'),
    // Adds 'aspect-ratio' utilities for video/image containers.
    require('@tailwindcss/aspect-ratio'),
    // Adds utilities for styling scrollbars.
    require('tailwind-scrollbar'),
  ],
}
