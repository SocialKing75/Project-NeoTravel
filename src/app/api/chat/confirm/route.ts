import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;

async function airtableGet(table: string, formula: string) {
  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await res.json();
  return data.records?.[0] ?? null;
}

async function airtableCreate(table: string, fields: Record<string, unknown>) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function POST(req: NextRequest) {
  const { email, prenom, depart, destination, passagers, date, tarifMin, tarifMax } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis." }, { status: 400 });

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";

  // Trouve ou crée le client dans Airtable
  const clientRecord =
    (await airtableGet("Clients", `{Email}='${email}'`)) ??
    (await airtableCreate("Clients", { Email: email }));

  const clientId = clientRecord?.id ?? null;

  // Crée le devis (champs réels de la table Airtable)
  const ref = `NT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const ht = Math.round((tarifMin + tarifMax) / 2 / 1.1);
  const ttc = Math.round((tarifMin + tarifMax) / 2);

  await airtableCreate("Devis", {
    ID_Devis: ref,
    Montant_HT: ht,
    Montant_TTC: ttc,
    Statut: "En attente",
    Date_creation: new Date().toISOString().split("T")[0],
    ...(clientId ? { Clients: [clientId] } : {}),
  });

  // Email de confirmation via Resend
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "NeoTravel <noreply@neotravel.fr>",
      to: email,
      subject: `Votre demande de devis NeoTravel — ${ref}`,
      html: `
        <p>Bonjour ${prenom ?? ""},</p>
        <p>Nous avons bien reçu votre demande de devis pour :</p>
        <ul>
          <li><strong>Trajet :</strong> ${depart ?? "—"} → ${destination ?? "—"}</li>
          <li><strong>Passagers :</strong> ${passagers ?? "—"}</li>
          ${date ? `<li><strong>Date :</strong> ${date}</li>` : ""}
          <li><strong>Tarif indicatif :</strong> ${fmt(tarifMin ?? 0)} – ${fmt(tarifMax ?? 0)} TTC</li>
        </ul>
        <p>Notre équipe reviendra vers vous sous <strong>24 h ouvrées</strong>.</p>
        <p>Référence : <strong>${ref}</strong></p>
        <p>À bientôt,<br/>L'équipe NeoTravel</p>
        <p style="color:#999;font-size:12px">09 80 40 04 84 · contact@neotravel.fr</p>
      `,
    }),
  });

  return NextResponse.json({ ok: true });
}
