/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── VEZEOR brand — Deep Transformative Teal ────────────────
        // App chrome (top bar, sidebar, active tabs). Not used for
        // primary CTAs anymore — those moved to gold per the new brief.
        brand: {
          25:  '#f2f7f7',
          50:  '#e8efef',
          100: '#d1dfdf',
          200: '#a3bfc0',
          300: '#759fa1',
          400: '#477f82',
          500: '#1f5f63',
          600: '#144245',
          700: '#0B4245',  // canonical
          800: '#073032',
          900: '#04181a',
        },
        // ── Rich Antique Gold — primary CTAs (Add, Pay, Save) ──────
        gold: {
          50:  '#f9f4e8',
          100: '#f3e9d1',
          200: '#e7d3a3',
          300: '#dbbd75',
          400: '#d0ac5f',
          500: '#C5A059',  // canonical
          600: '#a8884a',
          700: '#856b3a',
          800: '#5e4c29',
          900: '#382d18',
        },
        // ── Soft Sage Tint — selected card fill, success-state ─────
        sage: {
          50:  '#f0f7f4',
          100: '#D2E5DF',  // canonical
          200: '#b6d3ca',
          300: '#9ac1b5',
          400: '#7daea0',
          500: '#5d937e',
          600: '#477566',
        },
        // ── Charcoal — body text + button text on gold ─────────────
        charcoal: {
          DEFAULT: '#1E2525',
          900: '#1E2525',
          700: '#374040',
          500: '#4f5a5a',
        },
        navy: {
          700: '#1e293b',
          800: '#0f172a',
          900: '#080f1e',
        },
        canvas: '#FAFAFA',  /* Clean Canvas White */
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem',  { lineHeight: '0.875rem' }],
        'xs':  ['0.75rem',  { lineHeight: '1rem' }],
        'sm':  ['0.8125rem',{ lineHeight: '1.25rem' }],
        'base':['0.9375rem',{ lineHeight: '1.5rem' }],
      },
      boxShadow: {
        'xs':   '0 1px 2px 0 rgb(0 0 0 / .04)',
        'card': '0 1px 4px 0 rgb(0 0 0 / .06), 0 0 0 1px rgb(0 0 0 / .04)',
        'md':   '0 4px 12px -1px rgb(0 0 0 / .08), 0 2px 6px -2px rgb(0 0 0 / .06)',
        'lg':   '0 8px 24px -4px rgb(0 0 0 / .10), 0 4px 8px -4px rgb(0 0 0 / .06)',
        'pop':  '0 12px 32px -4px rgb(0 0 0 / .14), 0 4px 8px -2px rgb(0 0 0 / .08)',
        'glow': '0 0 0 3px rgb(11 66 69 / .18)',
        'inner-brand': 'inset 0 1px 0 0 rgb(255 255 255 / .12)',
      },
      borderRadius: {
        'sm':  '6px',
        'md':  '8px',
        'lg':  '10px',
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      animation: {
        'fade-in':     'fadeIn .15s ease-out',
        'slide-down':  'slideDown .18s ease-out',
        'slide-up':    'slideUp .22s cubic-bezier(.16,1,.3,1)',
        'scale-in':    'scaleIn .15s ease-out',
        'spin-slow':   'spin 2s linear infinite',
        'pulse-dot':   'pulseDot 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0', transform: 'translateY(-6px)' },  to: { opacity: '1', transform: 'none' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-10px)' }, to: { opacity: '1', transform: 'none' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(10px)' },  to: { opacity: '1', transform: 'none' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(.96)' },        to: { opacity: '1', transform: 'none' } },
        pulseDot:  { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
    },
  },
  plugins: [],
};
