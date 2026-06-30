import { NextResponse } from "next/server";
import { auth } from "../../../../auth";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;
// Table où atterrissent les demandes du chatbot. Surchargeable par env.
const TABLE = process.env.AIRTABLE_DEMANDES_TABLE ?? "Devis";

const pick = (f: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (f[k] != null && f[k] !== "") return f[k];
  return undefined;
};

export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "agent") {
    return NextResponse.json([], { status: 401 });
  }

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}` +
      `?sort[0][field]=Date_Creation&sort[0][direction]=desc&maxRecords=50`,
    { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
  );
  if (!res.ok) return NextResponse.json([], { status: 200 }); // démo : pas de 500 bloquant
  const data = await res.json();

  const demandes = (data.records ?? []).map(
    (r: { id: string; createdTime: string; fields: Record<string, unknown> }) => {
      const f = r.fields ?? {};
      return {
        id: r.id,
        prospect: pick(f, "Prospect", "Nom", "Nom_Client", "Client") ?? "Nouveau prospect",
        email: pick(f, "Email", "Email_Client") ?? "",
        tel: pick(f, "Telephone", "Tel", "Téléphone") ?? "",
        depart: pick(f, "Depart", "Départ", "Ville_Depart") ?? "—",
        destination: pick(f, "Destination", "Ville_Arrivee") ?? "—",
        passagers: Number(pick(f, "Passagers", "Nb_Passagers") ?? 0) || 0,
        tripDate: pick(f, "Date_Depart", "Date_Trajet") ?? "Date à confirmer",
        statut: pick(f, "Statut", "Status") ?? "Nouveau",
        tarif: Number(pick(f, "Montant_TTC", "Prix_TTC") ?? 0) || 0,
        createdAt: pick(f, "Date_Creation", "Date") ?? r.createdTime,
      };
    },
  );

  return NextResponse.json(demandes);
}
