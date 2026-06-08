/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // VEZEOR brand — Deep Teal. Primary actions, headers, navigation.
        brand: {
          25:  '#f2f7f7',
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
        // Rich Gold accent — CTA highlights, badges, special-offer pills.
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
        navy: {
          700: '#1e293b',
          800: '#0f172a',
          900: '#080f1e',
        },
        canvas: '#F8F9FA',  /* alabaster page background */
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
        'glow': '0 0 0 3px rgb(0 77 77 / .18)',
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
