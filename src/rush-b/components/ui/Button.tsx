import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { playTap, vibrate } from '../../lib/audio';

type Variant = 'primary' | 'danger' | 'ghost' | 'outline';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-spark text-void border-spark font-bold hover:brightness-110',
  danger:  'bg-threat text-chalk border-threat font-bold hover:brightness-110',
  outline: 'bg-transparent text-spark border-spark font-bold hover:bg-spark/10',
  ghost:   'bg-transparent text-smoke/60 border-transparent active:scale-100',
};

export function Button({ variant = 'primary', className = '', children, type = 'button', onClick, ...rest }: ButtonProps) {
  const base =
    'flex w-full items-center justify-center gap-2.5 rounded-[2px] ' +
    'border-2 px-[22px] py-[16px] ' +
    'font-rb-display text-[20px] tracking-[0.08em] ' +
    'transition-transform duration-[80ms] ' +
    'active:scale-[0.97] ' +
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
