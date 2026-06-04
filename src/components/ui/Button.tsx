import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { playTap, vibrate } from '../../lib/audio';

type Variant = 'primary' | 'dark' | 'gold' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  'data-testid'?: string;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-gold text-forest-dark border-gold font-extrabold hover:bg-gold-light',
  dark:    'bg-[rgba(10,18,8,0.85)] text-gold border-gold/35',
  gold:    'bg-gold text-forest-dark border-gold font-extrabold',
  ghost:   'bg-transparent text-parchment/72 border-transparent active:scale-100',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const base =
    'flex w-full items-center justify-center gap-2.5 rounded-[3px] ' +
    'border-[1.5px] px-[22px] py-[17px] ' +
    'font-display text-[15px] font-bold uppercase tracking-[0.06em] ' +
    'backdrop-blur-sm transition-transform duration-[80ms] ' +
    'active:scale-[0.98] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <button
      type={type}
      className={`${base} ${VARIANT_CLASS[variant]} ${className}`}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        playTap();
        vibrate(15);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
