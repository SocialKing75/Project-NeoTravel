import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { devisId, text } = await req.json();
  if (!devisId || !text?.trim()) return NextResponse.json({ error: "Données manquantes" }, { status: 400 });

  // Ajoute le message dans Airtable (table Messages ou champ Notes du Devis)
  await fetch(`https://api.airtable.com/v0/${BASE}/Messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        Devis: [devisId],
        Texte: text.trim(),
        Role: "client",
        Email: session.user.email,
        Date: new Date().toISOString(),
      },
    }),
  });

  return NextResponse.json({ ok: true });
}
