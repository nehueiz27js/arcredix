import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand ${compact ? "brand-compact" : ""}`} aria-label="ARCREDIX, inicio">
      <svg className="brand-mark" viewBox="0 0 52 52" role="img" aria-label="A verificada">
        <defs><linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#42F5C5"/><stop offset="1" stopColor="#00B889"/></linearGradient></defs>
        <path d="M26 4 4.5 45h11.2L26 24.8 36.2 45h11.3L26 4Z" fill="none" stroke="url(#brandGradient)" strokeWidth="7" strokeLinejoin="round"/>
        <path d="m14.5 29.5 8 7.5 16-17" fill="none" stroke="#F7FFFC" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="brand-word">ARCREDI<span>X</span></span>
    </Link>
  );
}
