import Link from "next/link";
import type { ReactNode } from "react";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" className="legal-logo-link">
            <img src="/assets/Neotravel-logo.svg" alt="Neotravel" className="legal-logo" />
          </Link>
          <Link href="/" className="legal-back">
            ← Retour à l’accueil
          </Link>
        </div>
      </header>

      <main className="legal-container">
        <div className="legal-card">
          <h1>{title}</h1>
          {intro && <p className="legal-intro">{intro}</p>}
          {children}
        </div>
      </main>

      <footer className="legal-footer">
        <span>© 2026 Neotravel — Tous droits réservés</span>
        <Link href="/">Retour à l’accueil</Link>
      </footer>
    </div>
  );
}
