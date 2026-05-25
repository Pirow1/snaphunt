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
          '0%':   { transform: 'rotate(-12deg) scale(0.2)', opacity: '0' },
          '60%':  { transform: 'rotate(-2deg)  scale(1.1)', opacity: '1' },
          '100%': { transform: 'rotate(-3deg)  scale(1)',   opacity: '1' },
        },
        'stamp-out': {
          '0%':   { transform: 'rotate(-3deg) scale(1)',   opacity: '1' },
          '100%': { transform: 'rotate(0deg)  scale(0.6)', opacity: '0' },
        },
        'new-pulse': {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
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
        'stamp-in':  'stamp-in 400ms cubic-bezier(0.5, -0.5, 0.3, 1.5) both',
        'stamp-out': 'stamp-out 250ms ease both',
        'new-pulse': 'new-pulse 300ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'radar-sweep': 'radar-sweep 3s linear infinite',
        'radar-ping': 'radar-ping 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
