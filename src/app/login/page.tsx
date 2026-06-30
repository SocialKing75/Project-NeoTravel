"use client";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const clientToken = params.get("client_token");
  const hasError = params.get("error");

  const [tab, setTab] = useState<"agent" | "client">("client");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(!!clientToken);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(
    hasError ? { text: "Identifiants incorrects ou lien expiré.", type: "err" } : null
  );

  // Auto-login client quand le magic link redirige ici avec le token
  useEffect(() => {
    if (!clientToken) return;
    signIn("client-token", { token: clientToken, redirect: false }).then(res => {
      if (res?.ok) {
        router.push("/espace-client");
      } else {
        setLoading(false);
        setMsg({ text: "Lien invalide ou expiré. Demandez-en un nouveau.", type: "err" });
      }
    });
  }, [clientToken]);

  const loginAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await signIn("agent", { email, password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      router.push("/");
    } else {
      setMsg({ text: "Email ou mot de passe incorrect.", type: "err" });
    }
  };

  const loginClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/client/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (res.ok) {
      setMsg({ text: "Lien envoyé ! Vérifiez votre boîte mail (pensez aux spams).", type: "ok" });
    } else {
      const data = await res.json();
      setMsg({ text: data.error ?? "Email non reconnu.", type: "err" });
    }
  };

  if (loading && clientToken) {
    return (
      <div className="nt-login-page">
        <div className="nt-login-card" style={{ textAlign: "center", color: "#6b7280" }}>
          Connexion en cours…
        </div>
      </div>
    );
  }

  return (
    <div className="nt-login-page">
      <div className="nt-login-photo" />
      <div className="nt-login-card">
        <div className="nt-login-logo">
          <img src="/assets/Neotravel-logo.svg" alt="NeoTravel" />
        </div>

        <div className="nt-login-tabs">
          <button
            className={tab === "client" ? "active" : ""}
            onClick={() => { setTab("client"); setMsg(null); }}
          >
            Espace client
          </button>
          <button
            className={tab === "agent" ? "active" : ""}
            onClick={() => { setTab("agent"); setMsg(null); }}
          >
            Espace agent
          </button>
        </div>

        {msg && <div className={`nt-login-msg ${msg.type}`}>{msg.text}</div>}

        {tab === "client" ? (
          <form onSubmit={loginClient} className="nt-login-form">
            <p className="nt-login-hint">
              Entrez l'email utilisé lors de votre demande de devis.
              Nous vous envoyons un lien de connexion.
            </p>
            <input
              type="email"
              placeholder="votre@email.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button type="submit" disabled={loading}>
              {loading ? "Envoi…" : "Me connecter"}
            </button>
          </form>
        ) : (
          <form onSubmit={loginAgent} className="nt-login-form">
            <input
              type="email"
              placeholder="Email agent"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        )}

        <a href="/" className="nt-login-back">← Retour au site</a>

        {(process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_BYPASS_EMAIL) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button
              style={{ width: "100%", background: "#f3f4f6", border: "1px dashed #9ca3af", borderRadius: 8, padding: "8px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
              onClick={() => signIn("client-token", { token: "bypass", redirect: false }).then(() => router.push("/espace-client"))}
            >
              [DEV] Connexion client bypass
            </button>
            <button
              style={{ width: "100%", background: "#f3f4f6", border: "1px dashed #9ca3af", borderRadius: 8, padding: "8px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}
              onClick={() => signIn("agent", { email: "agent@neotravel.fr", password: "test", redirect: false }).then(() => router.push("/"))}
            >
              [DEV] Connexion agent bypass
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
