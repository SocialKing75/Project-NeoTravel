import { NextResponse } from "next/server";
import { calculateDistanceKm, formatDistance } from "@/utils/distanceCalculator";

export const runtime = "nodejs";

type DevisRequest = {
  id: string;
  prospect: string;
  email: string;
  tel?: string;
  depart: string;
  destination: string;
  passagers?: number;
  tripDate?: string;
  vehicule?: string;
  message?: string;
};

const PRIX_KM = 3.2;
const TVA = 1.1;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getCoefficientPassagers(passagers: number) {
  if (passagers <= 8) return 0.9;
  if (passagers <= 30) return 1;
  if (passagers <= 55) return 1.25;
  return 1.5;
}

// Notification best-effort vers n8n/Airtable : ne doit jamais bloquer le calcul de tarif local,
// qui doit rester disponible (MVP de soutenance) même sans webhook configuré.
async function notifyN8n(body: DevisRequest) {
  const url = process.env.N8N_DEVIS_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
  if (!url) {
    console.warn("N8N_DEVIS_WEBHOOK_URL n'est pas configuré : notification ignorée.");
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        type: "devis_request",
        id: body.id,
        prospect: body.prospect,
        email: body.email,
        tel: body.tel ?? "",
        depart: body.depart,
        destination: body.destination,
        passagers: body.passagers ?? null,
        tripDate: body.tripDate ?? "",
        vehicule: body.vehicule ?? "",
        message: body.message ?? "",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`n8n a répondu ${res.status} pour la demande ${body.id}.`);
    }
  } catch (err) {
    console.error("Échec de la notification n8n :", err);
  }
}

export async function POST(req: Request) {
  let body: DevisRequest;
  try {
    const raw = await req.json();
    if (!isObject(raw)) throw new Error("invalid");
    body = raw as DevisRequest;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body.prospect?.trim() || !body.email?.trim() || !body.depart?.trim() || !body.destination?.trim()) {
    return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  }

  const distanceKm = calculateDistanceKm(body.depart, body.destination);
  const passagers = typeof body.passagers === "number" && body.passagers > 0 ? body.passagers : 1;

  const base = distanceKm * PRIX_KM;
  const coefficientPassagers = getCoefficientPassagers(passagers);
  const totalHT = Math.round(base * coefficientPassagers);
  const totalTTC = Math.round(totalHT * TVA);
  const tarifMin = Math.round(totalTTC * 0.9);
  const tarifMax = Math.round(totalTTC * 1.1);

  await notifyN8n(body);

  return NextResponse.json({
    success: true,
    distanceKm,
    tarifMin,
    tarifMax,
    totalHT,
    totalTTC,
    message: `Trajet ${body.depart} → ${body.destination} : ${formatDistance(distanceKm)}, tarif indicatif ${tarifMin} € - ${tarifMax} € TTC.`,
  });
}
