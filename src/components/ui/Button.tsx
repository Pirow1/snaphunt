import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'dark' | 'gold' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

// Matches snaphunt.html .btn / .btn-primary / .btn-dark / .btn-gold / .btn-ghost
// exactly: 2px ink border, 4px brutal shadow, active translates 3px and shrinks
// shadow to 1px. Tailwind only; no inline styles.
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-blaze text-cream hover:bg-blaze-deep',
  dark:    'bg-ink   text-cream',
  gold:    'bg-gold  text-ink',
  ghost:   'bg-transparent text-ink border-transparent shadow-none active:translate-x-0 active:translate-y-0 active:shadow-none',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const base =
    'flex w-full items-center justify-center gap-2.5 rounded-[2px] ' +
    'border-2 border-ink px-[22px] py-[18px] ' +
    'font-display text-[17px] font-bold uppercase tracking-tight ' +
    'shadow-brutal transition-[transform,box-shadow] duration-[80ms] ' +
    'active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)] ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <button type={type} className={`${base} ${VARIANT_CLASS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
