import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, prenom, depart, destination, passagers, date, tarifMin, tarifMax } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis." }, { status: 400 });

  const fmt = (n: number) => n.toLocaleString("fr-FR");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "NeoTravel <noreply@neotravel.fr>",
      to: email,
      subject: "Votre demande de devis NeoTravel",
      html: `
        <p>Bonjour ${prenom ?? ""},</p>
        <p>Nous avons bien reçu votre demande de devis pour :</p>
        <ul>
          <li><strong>Trajet :</strong> ${depart ?? "—"} → ${destination ?? "—"}</li>
          <li><strong>Passagers :</strong> ${passagers ?? "—"}</li>
          ${date ? `<li><strong>Date :</strong> ${date}</li>` : ""}
          <li><strong>Tarif indicatif :</strong> ${fmt(tarifMin)} € – ${fmt(tarifMax)} € TTC</li>
        </ul>
        <p>Notre équipe reviendra vers vous sous <strong>24 h ouvrées</strong> avec un devis définitif.</p>
        <p>À bientôt,<br/>L'équipe NeoTravel</p>
        <p style="color:#999;font-size:12px">09 80 40 04 84 · contact@neotravel.fr</p>
      `,
    }),
  });

  return NextResponse.json({ ok: true });
}
