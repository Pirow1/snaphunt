import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        'cream-2': 'var(--cream-2)',
        'cream-3': 'var(--cream-3)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        forest: 'var(--forest)',
        'forest-light': 'var(--forest-light)',
        blaze: 'var(--blaze)',
        'blaze-deep': 'var(--blaze-deep)',
        azure: 'var(--azure)',
        gold: 'var(--gold)',
        plum: 'var(--plum)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        brutal: '4px 4px 0 var(--ink)',
        'brutal-sm': '2px 2px 0 var(--ink)',
        'brutal-cream': '4px 4px 0 var(--cream)',
      },
      keyframes: {
        'stamp-in': {
          '0%':   { transform: 'rotate(-4deg) scale(3)',    opacity: '0' },
          '60%':  { transform: 'rotate(-4deg) scale(0.92)', opacity: '1' },
          '100%': { transform: 'rotate(-4deg) scale(1)',    opacity: '1' },
        },
        'stamp-out': {
          '0%':   { transform: 'rotate(-4deg) scale(1)',   opacity: '1' },
          '100%': { transform: 'rotate(-4deg) scale(0.6)', opacity: '0' },
        },
        'slide-in': {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        'new-pulse': {
          '0%':   { backgroundColor: 'var(--gold)' },
          '100%': { backgroundColor: 'var(--cream-2)' },
        },
        'blink': {
          '0%, 50%':   { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'radar-sweep': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'radar-ping': {
          '0%':   { transform: 'scale(0.7)', opacity: '1' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'stamp-in':  'stamp-in 600ms cubic-bezier(0.5, -0.5, 0.3, 1.5) both',
        'stamp-out': 'stamp-out 250ms ease both',
        'slide-in':  'slide-in 350ms ease both',
        'new-pulse': 'new-pulse 1s ease both',
        'blink':     'blink 1s infinite',
        'radar-sweep': 'radar-sweep 3s linear infinite',
        'radar-ping': 'radar-ping 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
