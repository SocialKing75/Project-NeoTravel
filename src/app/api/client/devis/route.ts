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

  // 1. Trouve le record client par email
  const clients = await airtable(
    `Gestion des Clients?filterByFormula=${encodeURIComponent(`{Email}='${session.user.email}'`)}&maxRecords=1`
  );
  const clientId = clients.records?.[0]?.id;
  if (!clientId) return NextResponse.json([]);

  // 2. Récupère ses devis
  const devisData = await airtable(
    `Devis?filterByFormula=${encodeURIComponent(`FIND('${clientId}', ARRAYJOIN({Clients}))`)}&sort[0][field]=Date_Creation&sort[0][direction]=desc`
  );

  const devis = (devisData.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => ({
    id: r.id,
    ref: r.fields.Ref_Devis ?? "—",
    depart: r.fields.Depart ?? "—",
    destination: r.fields.Destination ?? "—",
    date: r.fields.Date_Depart ?? "",
    montant_ttc: r.fields.Montant_TTC ?? 0,
    statut: r.fields.Statut ?? "devis_calcule",
    created: r.fields.Date_Creation ?? "",
  }));

  return NextResponse.json(devis);
}
