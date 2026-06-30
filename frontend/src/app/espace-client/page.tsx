"use client";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";

type Message = { role: "client" | "agent"; text: string; sentAt: string };

type Devis = {
  id: string;
  ref: string;
  depart: string;
  destination: string;
  date: string;
  montant_ttc: number;
  statut: string;
  created: string;
  messages?: Message[];
};

const STATUT_LABEL: Record<string, string> = {
  devis_calcule: "Devis calculé",
  "devis_envoyé": "Devis envoyé",
  "relancé_1": "En attente",
  "relancé_2": "En attente",
  "accepté": "Accepté",
  "réfusé": "Refusé",
  "clôturé": "Clôturé",
  nouveau: "Nouveau",
};

const STATUT_COLOR: Record<string, string> = {
  devis_calcule: "#2D9D5C",
  "devis_envoyé": "#3b82f6",
  "accepté": "#22c55e",
  "réfusé": "#ef4444",
  "clôturé": "#6b7280",
  nouveau: "#f59e0b",
};

const MOCK_DEVIS: Devis[] = [
  {
    id: "mock-1",
    ref: "NT-2026-0042",
    depart: "Paris",
    destination: "Lyon",
    date: "15 juillet 2026",
    montant_ttc: 1850,
    statut: "devis_envoyé",
    created: "2026-06-20T10:30:00Z",
    messages: [
      { role: "agent", text: "Bonjour ! Votre devis pour Paris → Lyon (45 passagers) est prêt. Montant TTC : 1 850 €. Chauffeur et carburant inclus.", sentAt: "2026-06-20T10:35:00Z" },
      { role: "client", text: "Merci ! Pouvez-vous me faire une remise pour un groupe scolaire ?", sentAt: "2026-06-21T09:10:00Z" },
      { role: "agent", text: "Bien sûr, nous appliquons une remise de 5% pour les groupes scolaires, soit 1 757 € TTC. Je vous envoie le devis révisé.", sentAt: "2026-06-21T11:00:00Z" },
    ],
  },
  {
    id: "mock-2",
    ref: "NT-2026-0051",
    depart: "Marseille",
    destination: "Nice",
    date: "3 août 2026",
    montant_ttc: 980,
    statut: "nouveau",
    created: "2026-06-28T14:00:00Z",
    messages: [],
  },
];

const SUGGESTIONS = [
  "Pouvez-vous me faire une remise ?",
  "Je souhaite modifier la date",
  "Pouvez-vous confirmer les détails ?",
  "J'ai une question sur le tarif",
  "Je souhaite contacter un commercial",
  "Je souhaite annuler ma demande",
  "Je souhaite un changement d'itinéraire",
];

export default function EspaceClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Devis | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated") {
      const role = (session.user as { role?: string }).role;
      if (role === "agent") { router.push("/"); return; }
      fetchDevis();
    }
  }, [status]);

  const fetchDevis = async () => {
    const res = await fetch("/api/client/devis");
    if (res.ok) {
      const data = await res.json();
      setDevis(data.length ? data : MOCK_DEVIS);
    } else {
      setDevis(MOCK_DEVIS);
    }
    setLoading(false);
  };

  const downloadPdf = (d: Devis) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("NeoTravel — Devis de transport", 20, 20);
    doc.setFontSize(11);
    doc.text(`Référence : ${d.ref}`, 20, 35);
    doc.text(`Trajet : ${d.depart} → ${d.destination}`, 20, 43);
    if (d.date) doc.text(`Date : ${d.date}`, 20, 51);
    doc.text(`Statut : ${STATUT_LABEL[d.statut] ?? d.statut}`, 20, 59);
    if (d.montant_ttc > 0) {
      doc.setFontSize(14);
      doc.text(`Montant TTC : ${d.montant_ttc.toLocaleString("fr-FR")} €`, 20, 72);
      doc.setFontSize(10);
      doc.text("Chauffeur et carburant inclus. Hors péages.", 20, 80);
    }
    doc.setFontSize(9);
    doc.text("NeoTravel · 09 80 40 04 84 · contact@neotravel.fr", 20, 280);
    doc.save(`${d.ref}.pdf`);
  };

  const downloadCsv = (d: Devis) => {
    const rows = [
      ["Référence", "Départ", "Destination", "Date", "Montant TTC", "Statut"],
      [d.ref, d.depart, d.destination, d.date, d.montant_ttc > 0 ? `${d.montant_ttc} €` : "—", STATUT_LABEL[d.statut] ?? d.statut],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${d.ref}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const sendMessage = async () => {
    if (!msg.trim() || !selected) return;
    setSending(true);
    await fetch("/api/client/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devisId: selected.id, text: msg.trim() }),
    });
    setSending(false);
    setSent(true);
    setMsg("");
    setTimeout(() => setSent(false), 3000);
  };

  if (status === "loading" || loading) {
    return <div className="nt-client-loading">Chargement…</div>;
  }

  return (
    <div className="nt-client-page">
      <header className="nt-client-header">
        <img src="/assets/Neotravel-logo.svg" alt="NeoTravel" style={{ height: 44 }} />
        <div className="nt-client-header-right">
          <span>{session?.user?.email}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })}>Déconnexion</button>
        </div>
      </header>

      <div className="nt-client-layout">
        {/* Liste des devis */}
        <main className="nt-client-main">
          <h1>Mes demandes</h1>

          {devis.length === 0 ? (
            <div className="nt-client-empty">
              <p>Aucune demande pour le moment.</p>
              <a href="/" className="nt-client-cta">Faire une demande</a>
            </div>
          ) : (
            <div className="nt-client-list">
              {devis.map(d => (
                <div
                  key={d.id}
                  className={`nt-client-card${selected?.id === d.id ? " active" : ""}`}
                  onClick={() => { setSelected(d); setSent(false); setMsg(""); }}
                >
                  <div className="nt-client-card-header">
                    <span className="nt-client-ref">{d.ref}</span>
                    <span className="nt-client-statut" style={{ background: STATUT_COLOR[d.statut] ?? "#6b7280" }}>
                      {STATUT_LABEL[d.statut] ?? d.statut}
                    </span>
                  </div>
                  <div className="nt-client-trajet">{d.depart} → {d.destination}</div>
                  {d.date && <div className="nt-client-date">{d.date}</div>}
                  {d.montant_ttc > 0 && (
                    <div className="nt-client-prix">{d.montant_ttc.toLocaleString("fr-FR")} € TTC</div>
                  )}
                  <div className="nt-client-card-actions" onClick={e => e.stopPropagation()}>
                    <button onClick={() => downloadPdf(d)}>⬇ PDF</button>
                    <button onClick={() => downloadCsv(d)}>⬇ Excel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Panneau détail + messagerie */}
        {selected && (
          <aside className="nt-client-panel">
            <div className="nt-client-panel-header">
              <div>
                <div className="nt-client-panel-ref">{selected.ref}</div>
                <div className="nt-client-panel-trajet">{selected.depart} → {selected.destination}</div>
              </div>
              <button className="nt-client-panel-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Suivi statut */}
            <div className="nt-client-panel-statut">
              <span style={{ background: STATUT_COLOR[selected.statut] ?? "#6b7280" }} className="nt-client-statut">
                {STATUT_LABEL[selected.statut] ?? selected.statut}
              </span>
              {selected.montant_ttc > 0 && (
                <span className="nt-client-panel-prix">{selected.montant_ttc.toLocaleString("fr-FR")} € TTC</span>
              )}
            </div>

            {/* Téléchargements */}
            <div className="nt-client-downloads">
              <button onClick={() => downloadPdf(selected)}>⬇ PDF</button>
              <button onClick={() => downloadCsv(selected)}>⬇ Excel (CSV)</button>
            </div>

            {/* Messages */}
            <div className="nt-client-messages">
              {(!selected.messages || selected.messages.length === 0) ? (
                <p className="nt-client-no-msg">Aucun message pour cette demande.</p>
              ) : (
                selected.messages.map((m, i) => (
                  <div key={i} className={`nt-client-msg ${m.role}`}>
                    <div className="nt-client-msg-bubble">{m.text}</div>
                    <div className="nt-client-msg-time">{new Date(m.sentAt).toLocaleDateString("fr-FR")}</div>
                  </div>
                ))
              )}
            </div>

            {/* Suggestions rapides */}
            <div className="nt-client-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setMsg(s)}>{s}</button>
              ))}
            </div>

            {/* Saisie message */}
            <div className="nt-client-compose">
              <textarea
                placeholder="Écrivez votre message… (remise, modification, question…)"
                value={msg}
                onChange={e => setMsg(e.target.value)}
                rows={3}
              />
              {sent && <div className="nt-client-sent">Message envoyé ✓</div>}
              <button onClick={sendMessage} disabled={sending || !msg.trim()}>
                {sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
