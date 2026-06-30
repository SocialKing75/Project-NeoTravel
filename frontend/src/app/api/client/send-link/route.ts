import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis." }, { status: 400 });

  // Vérifie que le client existe dans Airtable
  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent("Gestion des Clients")}?filterByFormula=${encodeURIComponent(`{Email}='${email}'`)}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const data = await res.json();
  if (!data.records?.length) {
    return NextResponse.json({ error: "Email non reconnu." }, { status: 404 });
  }

  // Génère un token JWT valable 10 minutes
  const token = await new SignJWT({ email, role: "client" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .setIssuedAt()
    .sign(SECRET);

  const link = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/client/verify?token=${token}`;

  // Envoie via Resend
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "NeoTravel <noreply@neotravel.fr>",
      to: email,
      subject: "Votre lien de connexion NeoTravel",
      html: `<p>Bonjour,</p><p><a href="${link}" style="background:#C2E812;color:#0E1C2B;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none">Accéder à mon espace client</a></p><p style="color:#999;font-size:12px">Ce lien expire dans 10 minutes.</p>`,
    }),
  });

  return NextResponse.json({ ok: true });
}
