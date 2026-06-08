/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── VEZEOR brand — Deep Transformative Teal ────────────────
        // Used for the top bar, navigation, active category tabs, and
        // any "this is the app chrome" surface. NOT used for primary
        // CTAs anymore — those moved to gold per the new brief.
        brand: {
          50:  '#e8efef',
          100: '#d1dfdf',
          200: '#a3bfc0',
          300: '#759fa1',
          400: '#477f82',
          500: '#1f5f63',
          600: '#144245',
          700: '#0B4245',  // ← the canonical brand teal
          800: '#073032',
          900: '#04181a',
        },
        // ── Rich Antique Gold — the "money zone" ───────────────────
        // Add to Cart, Place Order, Pay — anything tied to revenue.
        // Pairs with charcoal text for contrast; do not use white text
        // on gold (insufficient contrast on AAA tests).
        gold: {
          50:  '#f9f4e8',
          100: '#f3e9d1',
          200: '#e7d3a3',
          300: '#dbbd75',
          400: '#d0ac5f',
          500: '#C5A059',  // ← canonical accent
          600: '#a8884a',
          700: '#856b3a',
          800: '#5e4c29',
          900: '#382d18',
        },
        // ── Soft Sage Tint ─────────────────────────────────────────
        // Selected card fill, "you've picked this combo" backgrounds,
        // success-state pills. Calming next to the teal chrome.
        sage: {
          50:  '#f0f7f4',
          100: '#D2E5DF',  // ← canonical light accent
          200: '#b6d3ca',
          300: '#9ac1b5',
          400: '#7daea0',
          500: '#5d937e',
          600: '#477566',
        },
        // ── Charcoal — main body text + button text ────────────────
        // Softer than #000; chosen for long-session readability under
        // restaurant lighting. Also the "dark text on gold" for CTAs.
        charcoal: {
          DEFAULT: '#1E2525',
          900: '#1E2525',
          700: '#374040',
          500: '#4f5a5a',
        },
        // Clean Canvas White — main app background. Slightly off-white
        // so food photography pops on the pure-white menu cards.
        canvas: '#FAFAFA',
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
        // Ring pulse uses Rich Antique Gold so the loud-alert modal
        // matches the CTA family the customer is being asked to act on.
        'ring-blink': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(197, 160, 89, 0.7)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(197, 160, 89, 0)' },
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
