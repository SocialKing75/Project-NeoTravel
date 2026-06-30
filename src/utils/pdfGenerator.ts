import { jsPDF } from "jspdf";
import { formatDistance } from "./distanceCalculator";

export type DevisPdfMessage = {
  role: string;
  text: string;
  sentAt: Date;
};

export type DevisPdfDemande = {
  id: string;
  prospect: string;
  email: string;
  tel: string;
  depart: string;
  destination: string;
  passagers: number;
  tripDate: string;
  vehicule: string;
  statut: string;
  tarifMin: number;
  tarifMax: number;
  distanceKm?: number;
  messages: DevisPdfMessage[];
};

const MARGIN_X = 18;
const PAGE_BOTTOM = 280;
const fmtEuro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export function generateDevisPdf(demande: DevisPdfDemande): void {
  const doc = new jsPDF();
  let y = 22;

  const ensureSpace = (lineHeight: number) => {
    if (y + lineHeight > PAGE_BOTTOM) {
      doc.addPage();
      y = 22;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(13, 27, 45);
  doc.text("NeoTravel", MARGIN_X, y);
  y += 9;

  doc.setFontSize(14);
  doc.text("Devis de transport de groupe", MARGIN_X, y);
  y += 6;

  doc.setDrawColor(210, 210, 210);
  doc.line(MARGIN_X, y, 192, y);
  y += 9;

  const addLine = (label: string, value: string) => {
    ensureSpace(7);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(`${label} :`, MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", MARGIN_X + 48, y);
    y += 7;
  };

  addLine("Référence", demande.id);
  addLine("Prospect", demande.prospect);
  addLine("Email", demande.email);
  addLine("Téléphone", demande.tel || "—");
  addLine("Départ", demande.depart);
  addLine("Destination", demande.destination);
  addLine("Date du trajet", demande.tripDate || "—");
  addLine("Passagers", String(demande.passagers));
  addLine("Véhicule", demande.vehicule || "—");
  addLine("Statut", demande.statut);
  if (typeof demande.distanceKm === "number") {
    addLine("Distance estimée", formatDistance(demande.distanceKm));
  }

  y += 4;
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Tarif indicatif", MARGIN_X, y);
  y += 8;

  doc.setFontSize(17);
  doc.text(`${fmtEuro(demande.tarifMin)} - ${fmtEuro(demande.tarifMax)} TTC`, MARGIN_X, y);
  y += 7;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Tarif indicatif — distance à confirmer avant envoi.", MARGIN_X, y);
  y += 12;

  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Historique de la conversation", MARGIN_X, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);

  if (demande.messages.length === 0) {
    ensureSpace(6);
    doc.text("Aucun message pour le moment.", MARGIN_X, y);
    y += 6;
  } else {
    for (const m of demande.messages) {
      const prefix = m.role === "agent" ? "Agent" : "Client";
      const lines: string[] = doc.splitTextToSize(`${prefix} : ${m.text}`, 172);
      for (const line of lines) {
        ensureSpace(5.5);
        doc.text(line, MARGIN_X, y);
        y += 5.5;
      }
    }
  }

  const confidentialityNote =
    "Les données présentes dans ce document sont confidentielles et destinées exclusivement au traitement de cette demande.";
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(confidentialityNote, MARGIN_X, 292);
  }

  doc.save(`neotravel-devis-${demande.id}.pdf`);
}
