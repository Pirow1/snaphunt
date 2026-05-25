// Decorative concentric-circle + crosshair background.
// Verbatim from snaphunt.html lines 1282-1288.
export function CrosshairBg({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 opacity-50 ${className}`}>
      <svg
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
      >
        <circle cx="200" cy="200" r="120" fill="none" stroke="#1A1614" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.4" />
        <circle cx="200" cy="200" r="80"  fill="none" stroke="#1A1614" strokeWidth="1.5" opacity="0.3" />
        <circle cx="200" cy="200" r="40"  fill="none" stroke="#E94F2A" strokeWidth="2"   opacity="0.6" />
        <line x1="200" y1="40" x2="200" y2="360" stroke="#1A1614" strokeWidth="1" opacity="0.2" />
        <line x1="40" y1="200" x2="360" y2="200" stroke="#1A1614" strokeWidth="1" opacity="0.2" />
      </svg>
    </div>
  );
}
