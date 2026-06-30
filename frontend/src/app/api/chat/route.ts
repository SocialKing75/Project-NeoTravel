import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatRequest = {
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
  honeypot?: string;
  formTs?: number;
};

type ChatResponse = {
  reply: string;
  slots: Record<string, unknown> | null;
  missing: string[] | null;
  complete: boolean | null;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (isObject(value)) return value;
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Flattens n8n responses, either "flat" { message, slots, ... }
// or nested under { output: { message, slots, ... } } (Structured Output Parser).
function normalize(data: unknown): ChatResponse {
  let p: Record<string, unknown> = parseJsonObject(data) ?? {};

  // Unwrap a structured object, even when n8n returns it as a JSON string.
  const nested =
    parseJsonObject(p.output) ??
    parseJsonObject(p.message) ??
    parseJsonObject(p.reply) ??
    parseJsonObject(p.text);
  if (nested && ("message" in nested || "slots" in nested || "complete" in nested)) {
    p = nested;
  }

  const replyRaw =
    p.message ?? p.reply ?? (typeof p.output === "string" ? p.output : undefined) ?? p.text ?? "";

  return {
    reply: String(replyRaw),
    slots: isObject(p.slots) ? p.slots : null,
    missing: Array.isArray(p.missing) ? p.missing.map(String) : null,
    complete: typeof p.complete === "boolean" ? p.complete : null,
  };
}

export async function POST(req: Request) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL n'est pas configuré." },
      { status: 500 },
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body?.message?.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

  if (body.message.length > 2000) {
    return NextResponse.json({ error: "Message trop long." }, { status: 400 });
  }

  if (body.honeypot) {
    return NextResponse.json({ reply: "Merci pour votre message.", slots: null, missing: null, complete: null });
  }

  if (body.formTs && Date.now() - body.formTs < 2000) {
    return NextResponse.json({ reply: "Merci pour votre message.", slots: null, missing: null, complete: null });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // évite la page d'avertissement ngrok-free qui renverrait du HTML
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        message: body.message.slice(0, 2000),
        sessionId: (body.sessionId ?? "anon").replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 64) || "anon",
        context: body.context ?? {},
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `n8n a répondu ${res.status}.` },
        { status: 502 },
      );
    }

    // n8n peut renvoyer du JSON, du texte brut, ou un corps vide (200 sans body)
    const raw = await res.text();
    if (!raw.trim()) {
      return NextResponse.json({ reply: "", slots: null, missing: null, complete: null });
    }

    try {
      const data = JSON.parse(raw);
      return NextResponse.json(normalize(data));
    } catch {
      // pas du JSON → texte brut, pas de slot filling exploitable
      return NextResponse.json({ reply: raw, slots: null, missing: null, complete: null });
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Délai dépassé côté n8n." : "Échec de l'appel n8n." },
      { status: 504 },
    );
  }
}
