import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    'var(--void)',
        carbon:  'var(--carbon)',
        surface: 'var(--surface)',
        rim:     'var(--rim)',
        threat:  'var(--threat)',
        'threat-deep': 'var(--threat-deep)',
        spark:   'var(--spark)',
        'spark-dim':   'var(--spark-dim)',
        clear:   'var(--clear)',
        'clear-dim':   'var(--clear-dim)',
        smoke:   'var(--smoke)',
        ash:     'var(--ash)',
        chalk:   'var(--chalk)',
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Impact"', 'sans-serif'],
        sans:    ['"Rajdhani"', 'system-ui', 'sans-serif'],
        mono:    ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        brutal:      '4px 4px 0 var(--threat)',
        'brutal-y':  '4px 4px 0 var(--spark)',
        'brutal-sm': '2px 2px 0 var(--threat)',
        glow:        '0 0 12px var(--threat)',
        'glow-y':    '0 0 12px var(--spark)',
      },
      keyframes: {
        'stamp-in': {
          '0%':   { transform: 'rotate(-3deg) scale(3)',    opacity: '0' },
          '60%':  { transform: 'rotate(-3deg) scale(0.92)', opacity: '1' },
          '100%': { transform: 'rotate(-3deg) scale(1)',    opacity: '1' },
        },
        'blink': {
          '0%, 49%':   { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'danger-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'radar-sweep': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'radar-ping': {
          '0%':   { transform: 'scale(0.7)', opacity: '1' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        'explode': {
          '0%':   { transform: 'scale(1)',   opacity: '1' },
          '50%':  { transform: 'scale(1.3)', opacity: '0.8' },
          '100%': { transform: 'scale(0.8)', opacity: '0' },
        },
      },
      animation: {
        'stamp-in':     'stamp-in 600ms cubic-bezier(0.5,-0.5,0.3,1.5) both',
        'blink':        'blink 1s step-end infinite',
        'danger-pulse': 'danger-pulse 0.6s ease-in-out infinite',
        'radar-sweep':  'radar-sweep 3s linear infinite',
        'radar-ping':   'radar-ping 1.4s ease-out infinite',
        'slide-up':     'slide-up 350ms ease both',
        'explode':      'explode 600ms ease both',
      },
    },
  },
  plugins: [],
} satisfies Config;
