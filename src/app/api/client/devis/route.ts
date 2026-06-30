import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;

async function airtable(path: string) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return res.json();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json([], { status: 401 });

  // Trouve le record client par email
  const clients = await airtable(
    `Clients?filterByFormula=${encodeURIComponent(`{Email}='${session.user.email}'`)}&maxRecords=1`
  );
  const clientId = clients.records?.[0]?.id;
  if (!clientId) return NextResponse.json([]);

  // Récupère ses devis (champ lié "Clients" dans la table Devis)
  const devisData = await airtable(
    `Devis?filterByFormula=${encodeURIComponent(`FIND('${clientId}', ARRAYJOIN({Clients}))`)}&sort[0][field]=Date_creation&sort[0][direction]=desc`
  );

  const devis = (devisData.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => ({
    id: r.id,
    ref: r.fields.ID_Devis ?? "—",
    depart: "—",
    destination: "—",
    date: "",
    montant_ttc: r.fields.Montant_TTC ?? 0,
    statut: r.fields.Statut ?? "En attente",
    created: r.fields.Date_creation ?? "",
  }));

  return NextResponse.json(devis);
}
