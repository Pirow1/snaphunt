import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type PhotoCaptureProps = {
  onCapture: (file: File) => void;
  children: ReactNode;
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Forwarded to the trigger button. Class merges with the default. */
  buttonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'type'> & { 'data-testid'?: string };
};

/**
 * Hidden file input wired to the system camera (capture="environment") with
 * a styled trigger button. Resets the input value after each pick so the
 * same file can be re-captured.
 */
export function PhotoCapture({ onCapture, children, ariaLabel, buttonProps = {} }: PhotoCaptureProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
          e.target.value = '';
        }}
        data-testid="photo-input"
      />
      <button
        {...buttonProps}
        type="button"
        aria-label={ariaLabel}
        onClick={() => ref.current?.click()}
      >
        {children}
      </button>
    </>
  );
}
