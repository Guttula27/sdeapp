/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / .08), 0 1px 2px -1px rgb(0 0 0 / .06)',
        sheet: '0 -8px 30px rgb(0 0 0 / .12)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.25rem', '4xl': '1.5rem' },
      // Custom keyframes for blinking order cards / item rows / loud
      // alert modal. animate-pulse (built-in) is too gentle for "your
      // food is ready, look at me" signalling — we want a snappier
      // opacity drop and a flashing focus ring.
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.45' },
        },
        'ring-blink': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(249, 115, 22, 0.6)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(249, 115, 22, 0)' },
        },
      },
      animation: {
        blink: 'blink 1s ease-in-out infinite',
        'ring-blink': 'ring-blink 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
