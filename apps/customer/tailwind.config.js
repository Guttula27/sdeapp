/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // VEZEOR brand — Deep Teal. Used for primary actions, headers,
        // navigation, body typography. Calm and authoritative; pairs
        // well with the alabaster background and gold accents.
        brand: {
          50:  '#e6f2f2',
          100: '#cce5e5',
          200: '#99cccc',
          300: '#66b2b2',
          400: '#339999',
          500: '#006666',
          600: '#005757',
          700: '#004D4D',
          800: '#003939',
          900: '#002424',
        },
        // Rich Gold — reserved for accents, CTAs you want the eye drawn
        // to (Pay Now, primary "Add to cart"), and badges (bestseller,
        // popular). Use sparingly: too much gold dilutes the signal.
        gold: {
          50:  '#fdf9ec',
          100: '#faf0c4',
          200: '#f5e288',
          300: '#efd24c',
          400: '#e7c439',
          500: '#D4AF37',
          600: '#b89530',
          700: '#8c7124',
          800: '#604e19',
          900: '#3a2f0f',
        },
        // Soft alabaster surface — replaces the previous slate-50. Less
        // harsh than pure white in dim restaurant lighting, still feels
        // premium next to pure-white cards.
        canvas: '#F8F9FA',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / .08), 0 1px 2px -1px rgb(0 0 0 / .06)',
        sheet: '0 -8px 30px rgb(0 0 0 / .12)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.25rem', '4xl': '1.5rem' },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.45' },
        },
        // Ring pulse now uses Rich Gold — pops harder against the new
        // teal palette than the previous orange did.
        'ring-blink': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.65)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(212, 175, 55, 0)' },
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
