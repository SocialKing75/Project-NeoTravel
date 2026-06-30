"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { createDevisRequest } from "@/services";
import { formatDistance } from "@/utils/distanceCalculator";
import { generateDevisPdf } from "@/utils/pdfGenerator";

type Screen = "landing" | "dashboard" | "demandes";

type ChatMessage = { role: "agent" | "user"; text: string; sentAt: Date };

type DemandeStatus = "Nouveau" | "En cours" | "Devis envoyé" | "En attente" | "En relance" | "Accepté" | "Refusé";

type Demande = {
  id: string;
  prospect: string;
  email: string;
  tel: string;
  depart: string;
  destination: string;
  passagers: number;
  tripDate: string;
  vehicule: string;
  statut: DemandeStatus;
  tarifMin: number;
  tarifMax: number;
  createdAt: Date;
  messages: ChatMessage[];
  relances?: number;
  distanceKm?: number;
  rgpdConsent?: boolean;
};

type TripInfo = { depart?: string; destination?: string; passagers?: string; date?: string };

type NewDemandeInput = {
  prospect: string;
  email: string;
  tel: string;
  depart: string;
  destination: string;
  passagers: string;
  tripDate: string;
  vehicule: string;
  message: string;
  rgpdConsent: boolean;
};

/* ─── TIME / FORMAT HELPERS ───────────────────────────────────────────────── */

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(d: Date, now: Date) {
  const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);
  if (dayDiff <= 0) return `Auj. ${formatTime(d)}`;
  if (dayDiff === 1) return `Hier ${formatTime(d)}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function statusBadgeClass(statut: DemandeStatus) {
  if (statut === "En cours") return "blue";
  if (statut === "En attente" || statut === "En relance") return "warning";
  if (statut === "Refusé") return "danger";
  return "lime"; // Nouveau, Devis envoyé, Accepté
}

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function estimateTarif(passagers: number) {
  const pax = passagers > 0 ? passagers : 30;
  const tarifMin = 1200 + pax * 14;
  const tarifMax = Math.round(tarifMin * 1.32);
  return { tarifMin, tarifMax };
}

function parseTripQuery(query: string): TripInfo {
  const arrowMatch = query.match(/([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30}?)\s*(?:→|->)\s*([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,30})/);
  const paxMatch = query.match(/(\d+)\s*(?:personnes?|passagers?|pers\.?)/i);
  const dateMatch = query.match(/\b(\d{1,2}\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+\d{4})?)/i);
  return {
    depart: arrowMatch?.[1]?.trim(),
    destination: arrowMatch?.[2]?.trim().split(",")[0]?.trim(),
    passagers: paxMatch?.[1],
    date: dateMatch?.[1]?.trim(),
  };
}

/* ─── MOCK DEMANDES (timestamps anchored to the real current date) ──────────── */

function buildInitialDemandes(): Demande[] {
  const now = new Date();
  const today = new Date(now); today.setHours(9, 14, 0, 0);
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(14, 32, 0, 0);
  const threeDaysAgo = new Date(now); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3); threeDaysAgo.setHours(11, 5, 0, 0);
  const fiveDaysAgo = new Date(now); fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5); fiveDaysAgo.setHours(16, 40, 0, 0);

  return [
    {
      id: "NT-2026-0041",
      prospect: "Camille Roux",
      email: "c.roux@acme.fr",
      tel: "06 12 34 56 78",
      depart: "Paris",
      destination: "Lyon",
      passagers: 45,
      tripDate: "15 juillet 2026",
      vehicule: "Autocar grand tourisme",
      statut: "Nouveau",
      tarifMin: 1830,
      tarifMax: 2416,
      createdAt: today,
      messages: [
        { role: "user", text: "Bonjour, je cherche un autocar pour 45 personnes, départ Paris le 15 juillet direction Lyon pour un séminaire d'entreprise.", sentAt: today },
        { role: "agent", text: "Bonjour ! J'ai bien noté votre demande — laissez-moi quelques secondes pour analyser votre trajet.", sentAt: new Date(today.getTime() + 30 * 1000) },
        { role: "agent", text: "Parfait ! Paris → Lyon, 45 passagers, 15 juillet. Tarif indicatif : 1 830 € – 2 416 € TTC, chauffeur et carburant inclus. Souhaitez-vous un devis par email ?", sentAt: new Date(today.getTime() + 70 * 1000) },
        { role: "user", text: "Oui, envoyez-le à c.roux@acme.fr. Est-ce que vous avez des horaires avec retour le soir ?", sentAt: new Date(today.getTime() + 130 * 1000) },
      ],
    },
    {
      id: "NT-2026-0040",
      prospect: "Thomas Mercier",
      email: "t.mercier@rh-corp.fr",
      tel: "06 22 33 44 55",
      depart: "Bordeaux",
      destination: "Paris CDG",
      passagers: 8,
      tripDate: "2 juillet 2026",
      vehicule: "Minibus & van",
      statut: "En cours",
      tarifMin: 980,
      tarifMax: 1280,
      createdAt: yesterday,
      messages: [
        { role: "user", text: "Navette aéroport pour notre équipe RH, 8 personnes, départ Bordeaux vers Paris CDG.", sentAt: yesterday },
        { role: "agent", text: "Bonjour ! Je note votre besoin de navette. Avez-vous une date et une heure de vol précises ?", sentAt: new Date(yesterday.getTime() + 60 * 1000) },
      ],
    },
    {
      id: "NT-2026-0039",
      prospect: "Sophie Laurent",
      email: "s.laurent@ecole-jules.fr",
      tel: "06 33 44 55 66",
      depart: "Lyon",
      destination: "Grenoble",
      passagers: 38,
      tripDate: "18 juin 2026",
      vehicule: "Autocar grand tourisme",
      statut: "Devis envoyé",
      tarifMin: 1420,
      tarifMax: 1890,
      createdAt: threeDaysAgo,
      messages: [
        { role: "user", text: "Sortie scolaire terminée, avis très positif ! Merci pour le service.", sentAt: threeDaysAgo },
      ],
    },
    {
      id: "NT-2026-0038",
      prospect: "Marc Duval",
      email: "marc.duval@vignerons-reims.fr",
      tel: "06 44 55 66 77",
      depart: "Paris",
      destination: "Reims",
      passagers: 28,
      tripDate: "30 juin 2026",
      vehicule: "Autocar grand tourisme",
      statut: "En attente",
      tarifMin: 1100,
      tarifMax: 1450,
      createdAt: fiveDaysAgo,
      messages: [
        { role: "user", text: "Événement viticole, aller-retour dans la journée, êtes-vous disponibles ?", sentAt: fiveDaysAgo },
      ],
    },
  ];
}

type ApiDemande = {
  id: string;
  prospect: string;
  email: string;
  tel: string;
  depart: string;
  destination: string;
  passagers: number;
  tripDate: string;
  statut: string;
  tarif: number;
  createdAt: string;
};

const KNOWN_STATUTS: DemandeStatus[] = [
  "Nouveau", "En cours", "Devis envoyé", "En attente", "En relance", "Accepté", "Refusé",
];

function mapApiDemande(a: ApiDemande): Demande {
  const statut = (KNOWN_STATUTS as string[]).includes(a.statut) ? (a.statut as DemandeStatus) : "Nouveau";
  const tarif = a.tarif > 0 ? { tarifMin: a.tarif, tarifMax: a.tarif } : estimateTarif(a.passagers);
  return {
    id: a.id,
    prospect: a.prospect,
    email: a.email,
    tel: a.tel,
    depart: a.depart,
    destination: a.destination,
    passagers: a.passagers,
    tripDate: a.tripDate,
    vehicule: "À déterminer",
    statut,
    tarifMin: tarif.tarifMin,
    tarifMax: tarif.tarifMax,
    createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
    messages: [],
  };
}

function mergeDemandes(incoming: Demande[], prev: Demande[]): Demande[] {
  const existing = new Set(prev.map(d => d.id));
  const fresh = incoming.filter(d => !existing.has(d.id));
  return fresh.length ? [...fresh, ...prev] : prev;
}

export default function Home() {
  const { data: session } = useSession();
  const [screen, setScreen] = useState<Screen>("landing");
  const [demandes, setDemandes] = useState<Demande[]>(buildInitialDemandes);
  const [agentNotifications, setAgentNotifications] = useState(0);
  const [showNewDemande, setShowNewDemande] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedDemandeId, setSelectedDemandeId] = useState<string | null>(null);
  const [generatingDevisId, setGeneratingDevisId] = useState<string | null>(null);
  const demandeCounter = useRef(42);
  const now = useNow();
  const screenRef = useRef(screen);
  const knownDemandeIds = useRef<Set<string> | null>(null);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  useEffect(() => {
    if ((session?.user as { role?: string })?.role === "agent") {
      setScreen("dashboard");
    }
  }, [session]);

  // Polling des vraies demandes (Airtable via /api/demandes) → +1 sur la cloche.
  useEffect(() => {
    if ((session?.user as { role?: string })?.role !== "agent") return;
    let active = true;
    const poll = async () => {
      let rows: ApiDemande[];
      try {
        const res = await fetch("/api/demandes", { cache: "no-store" });
        if (!res.ok) return;
        rows = await res.json();
      } catch { return; }
      if (!active || !Array.isArray(rows)) return;
      const mapped = rows.map(mapApiDemande);

      if (knownDemandeIds.current === null) {
        // 1er chargement : on adopte sans notifier
        knownDemandeIds.current = new Set(mapped.map(d => d.id));
        setDemandes(prev => mergeDemandes(mapped, prev));
        return;
      }
      const fresh = mapped.filter(d => !knownDemandeIds.current!.has(d.id));
      if (fresh.length === 0) return;
      fresh.forEach(d => knownDemandeIds.current!.add(d.id));
      setDemandes(prev => mergeDemandes(fresh, prev));
      if (screenRef.current !== "demandes") setAgentNotifications(n => n + fresh.length);
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => { active = false; clearInterval(id); };
  }, [session]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const goScreen = (target: Screen) => {
    if (target === "demandes") setAgentNotifications(0);
    setScreen(target);
  };

  const addDemande = (info: TripInfo, rgpdConsent: boolean, prospectName = "Nouveau prospect", prospectEmail = "") => {
    const createdAt = new Date();
    const id = `NT-2026-${String(demandeCounter.current++).padStart(4, "0")}`;
    setDemandes(list => [
      {
        id,
        prospect: prospectName,
        email: prospectEmail,
        tel: "",
        depart: info.depart || "—",
        destination: info.destination || "—",
        passagers: info.passagers ? parseInt(info.passagers, 10) : 0,
        tripDate: info.date || "Date à confirmer",
        vehicule: "À déterminer",
        statut: "Nouveau",
        tarifMin: 0,
        tarifMax: 0,
        createdAt,
        messages: [],
        rgpdConsent,
      },
      ...list,
    ]);
    if (screen !== "demandes") setAgentNotifications(n => n + 1);

    const N8N_SAVE_URL = process.env.NEXT_PUBLIC_N8N_SAVE_DEMANDE_URL ?? "http://localhost:5678/webhook/save-demande";
    fetch(N8N_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospect: prospectName,
        email: prospectEmail,
        depart: info.depart || "—",
        destination: info.destination || "—",
        passagers: info.passagers ? parseInt(info.passagers, 10) : 0,
        tripDate: info.date || "Date à confirmer",
        statut: "Nouveau",
      }),
    }).catch(() => {});

    return id;
  };

  const appendMessage = (id: string, message: ChatMessage) => {
    setDemandes(list => list.map(d => (d.id === id ? { ...d, messages: [...d.messages, message] } : d)));
  };

  const addHistoryMessage = (demandeId: string, text: string) => {
    appendMessage(demandeId, { role: "agent", text, sentAt: new Date() });
  };

  const updateDemande = (demandeId: string, patch: Partial<Demande>) => {
    setDemandes(list => list.map(d => (d.id === demandeId ? { ...d, ...patch } : d)));
  };

  const updateDemandeTarif = (id: string, min: number, max: number) => {
    updateDemande(id, { tarifMin: min, tarifMax: max });
  };

  const selectDemande = (demandeId: string) => {
    setSelectedDemandeId(demandeId);
  };

  const getSelectedDemande = (): Demande | undefined => {
    return demandes.find(d => d.id === selectedDemandeId) ?? demandes[0];
  };

  const handleRelance = (demandeId: string) => {
    const target = demandes.find(d => d.id === demandeId);
    if (!target) return;
    updateDemande(demandeId, { statut: "En relance", relances: (target.relances ?? 0) + 1 });
    addHistoryMessage(demandeId, "Relance envoyée au prospect.");
    showToast(`Relance envoyée à ${target.prospect}`, "success");
  };

  const handleGenerateDevis = async (demandeId: string) => {
    const target = demandes.find(d => d.id === demandeId);
    if (!target) return;
    setGeneratingDevisId(demandeId);
    try {
      const conversation = target.messages.map(m => `${m.role}: ${m.text}`).join("\n");
      const result = await createDevisRequest({
        id: target.id,
        prospect: target.prospect,
        email: target.email,
        tel: target.tel,
        depart: target.depart,
        destination: target.destination,
        passagers: target.passagers,
        tripDate: target.tripDate,
        vehicule: target.vehicule,
        message: conversation,
      });

      const { tarifMin, tarifMax } =
        typeof result.tarifMin === "number" && typeof result.tarifMax === "number"
          ? { tarifMin: result.tarifMin, tarifMax: result.tarifMax }
          : estimateTarif(target.passagers);
      const distanceKm = typeof result.distanceKm === "number" ? result.distanceKm : target.distanceKm;

      updateDemande(demandeId, { statut: "Devis envoyé", tarifMin, tarifMax, distanceKm });
      addHistoryMessage(demandeId, "Devis généré et envoyé au prospect.");
      showToast(`Devis généré pour ${target.prospect}`, "success");

      try {
        generateDevisPdf({ ...target, statut: "Devis envoyé", tarifMin, tarifMax, distanceKm });
        addHistoryMessage(demandeId, "PDF du devis généré automatiquement.");
      } catch {
        showToast("Erreur lors de la génération du PDF.", "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Échec de la génération du devis.", "error");
    } finally {
      setGeneratingDevisId(null);
    }
  };

  const handleExport = (demandeId: string) => {
    const target = demandes.find(d => d.id === demandeId);
    if (!target) {
      showToast("Aucune demande sélectionnée.", "error");
      return;
    }
    try {
      generateDevisPdf(target);
      showToast("PDF du devis téléchargé.", "success");
    } catch {
      showToast("Erreur lors de la génération du PDF.", "error");
    }
  };

  const submitNewDemande = async (input: NewDemandeInput) => {
    const createdAt = new Date();
    const id = `NT-2026-${String(demandeCounter.current++).padStart(4, "0")}`;
    const passagers = input.passagers ? parseInt(input.passagers, 10) || 0 : 0;

    await createDevisRequest({
      id,
      prospect: input.prospect,
      email: input.email,
      tel: input.tel,
      depart: input.depart,
      destination: input.destination,
      passagers,
      tripDate: input.tripDate,
      vehicule: input.vehicule,
      message: input.message,
      rgpdConsent: input.rgpdConsent,
    });

    setDemandes(list => [
      {
        id,
        prospect: input.prospect,
        email: input.email,
        tel: input.tel,
        depart: input.depart,
        destination: input.destination,
        passagers,
        tripDate: input.tripDate || "Date à confirmer",
        vehicule: input.vehicule || "À déterminer",
        statut: "Nouveau",
        tarifMin: 0,
        tarifMax: 0,
        createdAt,
        messages: input.message ? [{ role: "user", text: input.message, sentAt: createdAt }] : [],
        rgpdConsent: true,
      },
      ...list,
    ]);
    selectDemande(id);
  };

  if (screen === "landing") {
    return (
      <Landing
        setScreen={goScreen}
        addDemande={addDemande}
        appendMessage={appendMessage}
        updateDemandeTarif={updateDemandeTarif}
      />
    );
  }

  return (
    <div className="operator-layout">
      <Sidebar screen={screen} setScreen={goScreen} demandesCount={demandes.length} />
      <main className="operator-main">
        <Topbar
          screen={screen}
          notifications={agentNotifications}
          now={now}
          onBell={() => goScreen("demandes")}
          onNewDemande={() => setShowNewDemande(true)}
        />
        {screen === "dashboard" && (
          <Dashboard
            setScreen={goScreen}
            demandes={demandes}
            now={now}
            selectDemande={selectDemande}
            handleRelance={handleRelance}
          />
        )}
        {screen === "demandes" && (
          <Demandes
            demandes={demandes}
            now={now}
            selectDemande={selectDemande}
            getSelectedDemande={getSelectedDemande}
            handleRelance={handleRelance}
            handleGenerateDevis={handleGenerateDevis}
            handleExport={handleExport}
            generatingDevisId={generatingDevisId}
          />
        )}
      </main>
      {showNewDemande && (
        <NewDemandeModal onClose={() => setShowNewDemande(false)} onSubmit={submitNewDemande} />
      )}
      {toast && <div className={`nt-toast ${toast.type}`} role="status">{toast.text}</div>}
    </div>
  );
}

/* ─── LANDING ─────────────────────────────────────────────────────────────── */

function Landing({
  setScreen,
  addDemande,
  appendMessage,
  updateDemandeTarif,
}: {
  setScreen: (s: Screen) => void;
  addDemande: (info: TripInfo, rgpdConsent: boolean, prospectName?: string, prospectEmail?: string) => string;
  appendMessage: (id: string, message: ChatMessage) => void;
  updateDemandeTarif: (id: string, min: number, max: number) => void;
}) {
  const [chatActive, setChatActive] = useState(false);
  const [showInfoForm, setShowInfoForm] = useState(false);
  const [userFirstName, setUserFirstName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  const [agentStage, setAgentStage] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [consentShake, setConsentShake] = useState(false);
  const [formTs] = useState(() => Date.now());
  const [sessionId] = useState(() => crypto.randomUUID());
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const consentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDemandeId = useRef<string | null>(null);
  const tripInfo = useRef<TripInfo>({});

  const scrollToForm = () => {
    if (formRef.current) {
      const y = formRef.current.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const addMsg = (role: "agent" | "user", text: string) => {
    const msg: ChatMessage = { role, text, sentAt: new Date() };
    setMessages(m => [...m, msg]);
    if (activeDemandeId.current) appendMessage(activeDemandeId.current, msg);
  };

  const callAgent = async (message: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, honeypot, formTs }),
      });
      const data = await res.json();
      if (res.ok && data.reply && String(data.reply).trim()) return String(data.reply);
      return null;
    } catch {
      return null;
    }
  };


  const priceMsg = () => {
    const pax = parseInt(tripInfo.current.passagers ?? "", 10) || 30;
    const { tarifMin: low, tarifMax: high } = estimateTarif(pax);
    const fmt = (n: number) => n.toLocaleString("fr-FR");
    if (activeDemandeId.current) updateDemandeTarif(activeDemandeId.current, low, high);
    return `D'après les éléments fournis, le tarif indicatif se situe entre ${fmt(low)} € et ${fmt(high)} € TTC, chauffeur et carburant inclus. Tarif indicatif — la distance exacte sera confirmée avant l'envoi du devis définitif.`;
  };

  const pushAgent = (text: string) => {
    setAgentTyping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      addMsg("agent", text);
      setAgentTyping(false);
    }, 1000);
  };

  const openChat = () => {
    if (!rgpdConsent) {
      setConsentShake(true);
      setTimeout(() => setConsentShake(false), 600);
      if (consentRef.current) {
        const y = consentRef.current.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
      return;
    }
    setShowInfoForm(true);
  };

  const startChat = () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim());
    if (!userFirstName.trim() || !emailOk) {
      setEmailError(!emailOk);
      return;
    }
    setEmailError(false);
    setShowInfoForm(false);

    const query = chatInput.trim();
    setChatActive(true);
    setAgentStage(0);
    setAgentTyping(true);
    if (timer.current) clearTimeout(timer.current);

    const parsed = parseTripQuery(query);
    tripInfo.current = parsed;
    activeDemandeId.current = addDemande(parsed, rgpdConsent, userFirstName.trim(), userEmail.trim());

    if (query) {
      addMsg("user", query);
    } else {
      setMessages([]);
    }

    const hasTrip = parsed.depart && parsed.destination;
    const hasPax = !!parsed.passagers;
    let greeting: string;
    if (hasTrip && hasPax) {
      greeting = `Bonjour ${userFirstName} ! J'ai bien noté votre trajet ${parsed.depart} → ${parsed.destination} pour ${parsed.passagers} passagers. Souhaitez-vous un aller simple ou un aller-retour ?`;
    } else if (hasTrip) {
      greeting = `Bonjour ${userFirstName} ! J'ai bien noté votre trajet ${parsed.depart} → ${parsed.destination}. Combien de passagers serez-vous ?`;
    } else {
      greeting = `Bonjour ${userFirstName} ! Je suis l'agent Neotravel, je suis là pour vous établir un devis personnalisé. Pouvez-vous me préciser votre ville de départ, votre destination et le nombre de passagers ?`;
    }
    timer.current = setTimeout(() => {
      addMsg("agent", greeting);
      setAgentTyping(false);
    }, 850);
  };

  const respond = (userText: string) => {
    const t = userText.toLowerCase();
    let reply: string;
    if (/(prix|tarif|co[uû]t|combien|budget|devis)/.test(t)) {
      reply = priceMsg();
    } else if (/(conseiller|humain|appel|rappel|t[ée]l[ée]phone|parler)/.test(t)) {
      reply = "Bien sûr. Un chargé d'affaires Neotravel peut vous rappeler sous 24 h ouvrées.";
    } else if (agentStage === 0) {
      reply = `Parfait. Pour ${tripInfo.current.depart || "votre départ"} → ${tripInfo.current.destination || "votre destination"}, j'estime la distance et le temps de conduite. Avez-vous une date précise, ou êtes-vous flexible ?`;
    } else if (agentStage === 1) {
      reply = priceMsg();
    } else if (agentStage === 2) {
      reply = "Très bien. Je peux vous envoyer ce devis par email et programmer un rappel. Souhaitez-vous que je le fasse ?";
    } else {
      reply = "C'est noté, votre demande est transmise à notre équipe. Avez-vous une exigence particulière à ajouter ?";
    }
    setAgentStage(s => s + 1);
    pushAgent(reply);
  };

  const toggleMic = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    rec.start();
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;

    addMsg("user", text);
    setChatInput("");

    setAgentTyping(true);
    const reply = await callAgent(text);
    setAgentTyping(false);

    if (reply) {
      addMsg("agent", reply);
    } else {
      respond(text);
    }
  };

  const onQuick = async (text: string) => {
    addMsg("user", text);
    setAgentTyping(true);
    const reply = await callAgent(text);
    setAgentTyping(false);
    if (reply) {
      addMsg("agent", reply);
    } else {
      respond(text);
    }
  };

  return (
    <div className="nt-page">

      {/* HEADER */}
      <header className="nt-header">
        <div className="nt-header-inner">
          <img src="/assets/Neotravel-logo.svg" alt="Neotravel" className="nt-logo" />
          <nav className="nt-nav">
            <a className="active" href="#">Accueil</a>
            <a href="#">Qui sommes-nous</a>
            <a href="#services">Services &amp; garanties</a>
            <a href="#flotte">Flotte</a>
            <a href="#avis">Avis clients</a>
            <a href="#">Blog</a>
          </nav>
          <div className="nt-header-actions">
            <a className="nt-phone-btn" href="/login">Connexion</a>
          </div>
        </div>
      </header>

      <section className="nt-hero nt-hero-home">
        <div className="nt-hero-photo" />
        <div className="nt-hero-inner hero-home-inner">
          <div className="nt-hero-text">
            <h1 className="nt-h1 nt-h1-home">
              Organisez votre transport de groupe<br />en toute simplicité
            </h1>
            {!chatActive ? (
              <p className="nt-hero-desc nt-hero-desc-home">
                Décrivez votre besoin, échangez avec notre assistant IA et recevez un devis personnalisé en quelques minutes grâce à notre réseau d’autocaristes partenaires partout en France.
              </p>
            ) : (
              <div className="nt-chat-panel">
                <div className="nt-chat-header">
                  <div>
                    <strong>Conversation avec l’agent Neotravel</strong>
                    <p>Votre assistant de devis est prêt à répondre à vos questions.</p>
                  </div>
                  <button type="button" className="nt-chat-close" onClick={() => setChatActive(false)}>
                    Fermer
                  </button>
                </div>
                <div className="nt-chat-messages">
                  {messages.map((m, i) => (
                    <div key={i} className={`nt-chat-message ${m.role}`}>
                      <p>{m.text}</p>
                    </div>
                  ))}
                  {agentTyping && (
                    <div className="nt-chat-message agent">
                      <div className="nt-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}
                </div>
                <div className="nt-chat-input">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder="Décrivez votre trajet... ex : Paris → Lyon, 45 personnes, 15 juillet"
                  />
                  <button type="button" className={`nt-mic-btn${listening ? " nt-mic-active" : ""}`} aria-label={listening ? "Arrêter" : "Microphone"} onClick={toggleMic}>
                    <img src="/assets/mic.svg" alt="" width="20" height="20" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    style={{ display: "none" }}
                    onChange={e => setAttachedFile(e.target.files?.[0] ?? null)}
                  />
                  <button type="button" className="nt-mic-btn" aria-label="Joindre un fichier Excel" onClick={() => fileInputRef.current?.click()}>
                    <img src="/assets/attach.png" alt="" width="20" height="20" />
                  </button>
                  <button className="nt-send-btn" onClick={sendChat} aria-label="Envoyer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E1C2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
                    </svg>
                  </button>
                </div>
                {attachedFile && (
                  <div className="nt-attached-file">
                    <img src="/assets/attach.png" alt="" width="14" height="14" style={{ opacity: .5 }} />
                    <span>{attachedFile.name}</span>
                    <button type="button" onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Retirer le fichier">×</button>
                  </div>
                )}
                <div className="nt-chat-quicks">
                  {[
                    "Aller-retour",
                    "Quel est le tarif ?",
                    "Je suis flexible sur les dates",
                    "Parler à un conseiller",
                  ].map(q => (
                    <button key={q} type="button" className="nt-quick" onClick={() => onQuick(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {!chatActive && showInfoForm && (
              <div className="nt-search-card nt-info-form">
                <p className="nt-info-form-title">Avant de commencer</p>
                <div className="nt-info-form-row">
                  <div className="nt-info-form-group">
                    <label>Prénom *</label>
                    <input
                      autoFocus
                      value={userFirstName}
                      onChange={e => setUserFirstName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") startChat(); }}
                      placeholder="Camille"
                    />
                  </div>
                  <div className="nt-info-form-group">
                    <label>Adresse email *</label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={e => { setUserEmail(e.target.value); setEmailError(false); }}
                      onKeyDown={e => { if (e.key === "Enter") startChat(); }}
                      placeholder="vous@exemple.fr"
                      className={emailError ? "nt-input-error" : ""}
                    />
                    {emailError && <span className="nt-field-error">Email invalide</span>}
                  </div>
                </div>
                <button className="nt-info-submit" onClick={startChat}>
                  Démarrer la conversation
                </button>
              </div>
            )}

            {!chatActive && !showInfoForm && (
              <div className="nt-search-card">
                <input
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ display: "none", position: "absolute", left: "-9999px" }}
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  autoComplete="off"
                  name="website"
                />
                <div className="nt-search-input">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); openChat(); } }}
                    placeholder="Décrivez votre trajet... ex : Paris → Lyon, 45 personnes, 15 juillet"
                  />
                  <button className="nt-search-go" onClick={openChat} aria-label="Lancer l'agent IA" disabled={!rgpdConsent}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E1C2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
                <div ref={consentRef} className={`rgpd-consent${consentShake ? " rgpd-shake" : ""}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={rgpdConsent}
                      onChange={e => setRgpdConsent(e.target.checked)}
                    />
                    <span>
                      J’accepte que NeoTravel traite mes données personnelles afin de répondre à
                      ma demande de devis, conformément à la{" "}
                      <Link href="/confidentialite">Politique de confidentialité</Link>.
                    </span>
                  </label>
                </div>
              </div>
            )}

            <p className="privacy-note">
              Les informations transmises via le chatbot sont utilisées uniquement pour qualifier
              votre demande de devis. Elles peuvent être traitées par notre agent IA, n8n et
              Airtable dans le cadre du suivi commercial. <Link href="/confidentialite">En savoir plus</Link>.
            </p>
          </div>
        </div>
      </section>

        {/* Trust strip */}
        <div className="nt-trust">
          <div className="nt-trust-inner">
            {[
              { svg: <IcoShield />, title: "Sécurité", desc: "Autocaristes certifiés & assurés" },
              { svg: <IcoUsers />, title: "Confort", desc: "Véhicules récents tout équipés" },
              { svg: <IcoClock />, title: "Ponctualité", desc: "Suivi en temps réel de votre trajet" },
            ].map(({ svg, title, desc }) => (
              <div key={title} className="nt-trust-item">
                <div className="nt-trust-icon">{svg}</div>
                <div>
                  <div className="nt-trust-title">{title}</div>
                  <div className="nt-trust-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* SERVICES */}
      <section id="services" className="nt-section nt-section-light">
        <div className="nt-section-inner">
          <div className="nt-section-head center">
            <div className="nt-label">NOS SERVICES</div>
            <h2 className="nt-h2">Un transport adapté à chaque occasion</h2>
            <p className="nt-section-desc">Mariages, séminaires, sorties scolaires, transferts aéroport ou événements sportifs — nous mobilisons le véhicule et le chauffeur qu’il vous faut.</p>
          </div>
          <div className="nt-4grid">
            {[
              { icon: <IcoBus />, title: "Autocar grand tourisme", desc: "Jusqu'à 63 places, idéal pour les longs trajets, voyages scolaires et excursions de groupe." },
              { icon: <IcoMinibus />, title: "Minibus & van", desc: "De 8 à 22 places avec chauffeur, parfait pour les petits groupes et transferts professionnels." },
              { icon: <IcoEvent />, title: "Événementiel & séminaires", desc: "Coordination de flottes pour congrès, mariages et déplacements d'entreprise sur mesure." },
              { icon: <IcoPlane />, title: "Navette aéroport", desc: "Transferts ponctuels vers et depuis les aéroports et gares, avec suivi des horaires de vol." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="nt-service-card">
                <div className="nt-service-icon">{icon}</div>
                <h3 className="nt-service-title">{title}</h3>
                <p className="nt-service-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="nt-section nt-section-white">
        <div className="nt-section-inner">
          <div className="nt-section-head center">
            <div className="nt-label">COMMENT ÇA MARCHE</div>
            <h2 className="nt-h2">Votre devis en 3 étapes</h2>
            <p className="nt-section-desc">Un assistant IA qualifie votre demande, un moteur déterministe calcule le tarif, un conseiller valide avant l’envoi.</p>
          </div>
          <div className="nt-3grid">
            <div className="nt-step-card">
              <div className="nt-step-num">ÉTAPE 01</div>
              <h3 className="nt-step-title">Décrivez votre trajet</h3>
              <p className="nt-step-desc">Départ, destination, dates et nombre de passagers. Quelques secondes suffisent.</p>
            </div>
            <div className="nt-step-card">
              <div className="nt-step-num">ÉTAPE 02</div>
              <h3 className="nt-step-title">L’agent IA estime</h3>
              <p className="nt-step-desc">L’assistant pose les bonnes questions et calcule un tarif indicatif, traçable et sans surprise.</p>
            </div>
            <div className="nt-step-card">
              <div className="nt-step-num">ÉTAPE 03</div>
              <h3 className="nt-step-title">Recevez votre devis</h3>
              <p className="nt-step-desc">Un conseiller confirme la distance et vous envoie le devis définitif sous 24 h.</p>
              <button className="nt-step-cta" onClick={openChat}>Démarrer avec l’agent IA</button>
            </div>
          </div>
        </div>
      </section>

      {/* FLOTTE */}
      <section id="flotte" className="nt-section nt-section-dark">
        <div className="nt-fleet-glow" />
        <div className="nt-section-inner">
          <div className="nt-fleet-grid">
            <div>
              <div className="nt-label lime">NOTRE FLOTTE</div>
              <h2 className="nt-h2 white">Des véhicules récents, entretenus et équipés</h2>
              <p className="nt-fleet-desc">Autocars, minibus, vans et navettes : un parc partenaire varié pour répondre à tous vos besoins de mobilité de groupe, partout en Europe.</p>
              <ul className="nt-fleet-list">
                {["Autocars grand tourisme 50 à 63 places", "Minibus & vans 8 à 22 places", "Bus privé & VIP haut de gamme", "Wi-Fi, climatisation, prises USB & soute"].map(item => (
                  <li key={item}>
                    <span className="nt-fleet-dot" />
                    {item}
                  </li>
                ))}
              </ul>
              <button className="nt-btn-lime" onClick={scrollToForm}>
                Demander un devis
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            <div className="nt-fleet-img">
              <img src="/assets/back.png" alt="Flotte Neotravel" />
            </div>
          </div>
        </div>
      </section>

      {/* AVIS */}
      <section id="avis" className="nt-section nt-section-light">
        <div className="nt-section-inner">
          <div className="nt-section-head center">
            <div className="nt-label">AVIS CLIENTS</div>
            <h2 className="nt-h2">Ils nous font confiance</h2>
          </div>
          <div className="nt-3grid">
            {[
              { initials: "CR", name: "Camille Roux", role: "Responsable événementiel", text: "« Devis reçu en quelques minutes et chauffeur impeccable pour notre séminaire de 48 personnes. On recommande sans hésiter. »" },
              { initials: "TM", name: "Thomas Mercier", role: "Office manager", text: "« Transfert aéroport pour notre équipe : ponctuel, confortable et un suivi en temps réel très rassurant. »" },
              { initials: "SL", name: "Sophie Laurent", role: "Directrice d'école", text: "« Sortie scolaire de 2 cars : organisation simple, tarif clair dès le départ et chauffeurs très professionnels. »" },
            ].map(({ initials, name, role, text }) => (
              <div key={name} className="nt-review-card">
                <Stars />
                <p className="nt-review-text">{text}</p>
                <div className="nt-reviewer">
                  <div className="nt-reviewer-avatar">{initials}</div>
                  <div>
                    <div className="nt-reviewer-name">{name}</div>
                    <div className="nt-reviewer-role">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="nt-cta-band">
        <div className="nt-cta-band-inner">
          <div>
            <h2 className="nt-cta-band-title">Prêt à réserver votre prochain trajet ?</h2>
            <p className="nt-cta-band-desc">Obtenez un devis indicatif en quelques minutes, sans engagement.</p>
          </div>
          <div className="nt-cta-band-actions">
            <button className="nt-btn-dark-outline" onClick={openChat}>Parler à l’agent IA</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="nt-footer">
        <div className="nt-footer-inner">
          <div>
            <img src="/assets/Neotravel-logo.svg" alt="Neotravel" className="nt-footer-logo" />
            <p className="nt-footer-desc">Location d’autocar, minibus et bus privé avec chauffeur. Votre trajet, notre priorité.</p>
            <div className="nt-footer-phone">09 80 40 04 84</div>
          </div>
          <div>
            <div className="nt-footer-col-title">Société</div>
            <div className="nt-footer-links">
              {["Qui sommes-nous", "Services & garanties", "Notre flotte", "Avis clients", "Blog"].map(l => (
                <a key={l} href="#">{l}</a>
              ))}
            </div>
          </div>
          <div>
            <div className="nt-footer-col-title">Contact</div>
            <div className="nt-footer-links">
              <a href="tel:0980400484">09 80 40 04 84</a>
              <a href="mailto:contact@neotravel.fr">contact@neotravel.fr</a>
              <span>Du lundi au samedi, 8h–20h</span>
            </div>
            <button className="nt-btn-lime-sm" onClick={scrollToForm}>Devis gratuit</button>
          </div>
        </div>
        <div className="nt-footer-bottom">
          <span>© 2026 Neotravel — Tous droits réservés</span>
          <div className="nt-footer-legal">
            {[
              { label: "Mentions légales", href: "/mentions-legales" },
              { label: "CGV", href: "/cgv" },
              { label: "Confidentialité", href: "/confidentialite" },
              { label: "Cookies", href: "/cookies" },
            ].map(l => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── STARS ───────────────────────────────────────────────────────────────── */

function Stars() {
  return (
    <div className="nt-stars">
      {[0,1,2,3,4].map(i => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#C2E812">
          <path d="m12 2 3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.8 5.4 21.7l1.8-7.3L1.5 9.5 9 8.9z" />
        </svg>
      ))}
    </div>
  );
}

/* ─── INLINE SVG ICONS ────────────────────────────────────────────────────── */

const S = ({ children }: { children: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2E812" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const IcoShield = () => <S><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></S>;
const IcoUsers = () => <S><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></S>;
const IcoClock = () => <S><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></S>;
const IcoBus = () => <S><path d="M8 6v6M16 6v6M2 12h20" /><rect x="3" y="4" width="18" height="12" rx="2" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></S>;
const IcoMinibus = () => <S><path d="M3 9h18v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9zM3 9l2-5h14l2 5" /><path d="M7 13h.01M15 13h2" /></S>;
const IcoEvent = () => <S><path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></S>;
const IcoPlane = () => <S><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></S>;

/* ─── OPERATOR ICONS ──────────────────────────────────────────────────────── */

function OpIcon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const IcoGrid = () => <OpIcon size={16}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></OpIcon>;
const IcoDocList = () => <OpIcon size={16}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M9 12h6M9 16h6M9 8h3" /></OpIcon>;
const IcoHome = () => <OpIcon size={16}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" /></OpIcon>;
const IcoBell = () => <OpIcon size={17}><path d="M6 9a6 6 0 1 1 12 0c0 3 1 5 1.5 6H4.5C5 14 6 12 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></OpIcon>;
const IcoPlus = () => <OpIcon size={14}><path d="M12 5v14M5 12h14" /></OpIcon>;
const IcoLogout = () => <OpIcon size={15}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></OpIcon>;
const IcoRefresh = () => <OpIcon size={16}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 4v4h-4" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 20v-4h4" /></OpIcon>;
const IcoFile = () => <OpIcon size={16}><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M9 13h6M9 17h4" /></OpIcon>;
const IcoExport = () => <OpIcon size={16}><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></OpIcon>;
const IcoChatBubble = () => <OpIcon><path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7l-4 4V5a1 1 0 0 1 1-1z" /><path d="M8 10h8M8 7h5" /></OpIcon>;
const IcoSend2 = () => <OpIcon><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></OpIcon>;
const IcoCheckCircle2 = () => <OpIcon><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 5-5.5" /></OpIcon>;
const IcoCoins = () => <OpIcon><circle cx="9" cy="9" r="5.5" /><path d="M14.5 9c2.5 0 4.5 2 4.5 4.5S17 18 14.5 18 10 16 10 13.5" /></OpIcon>;

/* ─── OPERATOR ────────────────────────────────────────────────────────────── */

function Sidebar({ screen, setScreen, demandesCount }: { screen: Screen; setScreen: (s: Screen) => void; demandesCount: number }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/assets/Neotravel-logo.svg" alt="Neotravel" />
      </div>
      <p className="side-title">Espace commercial</p>
      <nav className="sidebar-nav">
        <button className={screen === "dashboard" ? "active" : ""} onClick={() => setScreen("dashboard")}>
          <IcoGrid />
          <span className="nav-label">Tableau de bord</span>
        </button>
        <button className={screen === "demandes" ? "active" : ""} onClick={() => setScreen("demandes")}>
          <IcoDocList />
          <span className="nav-label">Demandes</span>
          <span className="nav-badge">{demandesCount}</span>
        </button>
      </nav>
      <div className="sidebar-divider" />
      <button type="button" className="sidebar-secondary" onClick={() => setScreen("landing")}>
        <IcoHome />
        <span className="nav-label">Voir le site client</span>
      </button>
      <div className="sidebar-user">
        <div>AG</div>
        <section>
          <strong>Agent Commercial</strong>
          <span>agent@neotravel.fr</span>
        </section>
        <button type="button" className="sidebar-logout" aria-label="Se déconnecter" onClick={() => setScreen("landing")}>
          <IcoLogout />
        </button>
      </div>
    </aside>
  );
}

function Topbar({
  screen,
  notifications,
  now,
  onBell,
  onNewDemande,
}: {
  screen: Screen;
  notifications: number;
  now: Date;
  onBell: () => void;
  onNewDemande: () => void;
}) {
  const titles: Record<Screen, string> = {
    dashboard: "Tableau de bord",
    demandes: "Demandes",
    landing: "",
  };
  const subs: Partial<Record<Screen, string>> = {
    dashboard: "Vue d'ensemble de l'activité commerciale",
    demandes: "Toutes les demandes de devis reçues via le chatbot",
  };
  const today = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <header className="topbar topbar-operator">
      <div>
        {titles[screen] && <h1>{titles[screen]}</h1>}
        <p>{subs[screen]}</p>
      </div>
      <div className="topbar-actions topbar-operator-actions">
        <button type="button" className="icon-btn topbar-bell" aria-label="Notifications" onClick={onBell}>
          <IcoBell />
          {notifications > 0 && <span className="topbar-bell-dot">{notifications > 9 ? "9+" : notifications}</span>}
        </button>
        <span className="topbar-date">{today}</span>
        <button type="button" className="topbar-new-btn" onClick={onNewDemande}><IcoPlus />Nouvelle demande</button>
      </div>
    </header>
  );
}

const emptyNewDemande: NewDemandeInput = {
  prospect: "",
  email: "",
  tel: "",
  depart: "",
  destination: "",
  passagers: "",
  tripDate: "",
  vehicule: "",
  message: "",
  rgpdConsent: false,
};

function NewDemandeModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: NewDemandeInput) => Promise<void>;
}) {
  const [form, setForm] = useState<NewDemandeInput>(emptyNewDemande);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof NewDemandeInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
  };

  const isValid = Boolean(
    form.prospect.trim() && form.email.trim() && form.depart.trim() && form.destination.trim() && form.rgpdConsent,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="op-modal-overlay" onMouseDown={onClose}>
      <div className="op-modal" onMouseDown={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="op-modal-header">
            <h2>Nouvelle demande</h2>
            <p>Créez une demande de devis et transmettez-la par email au client.</p>
            <button type="button" className="op-modal-close" aria-label="Fermer" onClick={onClose}>×</button>
          </div>

          <div className="op-modal-body">
            <div className="op-form-row">
              <div className="op-form-group">
                <label htmlFor="nd-prospect">Nom du client *</label>
                <input id="nd-prospect" required value={form.prospect} onChange={set("prospect")} placeholder="Camille Roux" />
              </div>
              <div className="op-form-group">
                <label htmlFor="nd-email">Email *</label>
                <input id="nd-email" type="email" required value={form.email} onChange={set("email")} placeholder="client@exemple.fr" />
              </div>
            </div>

            <div className="op-form-row">
              <div className="op-form-group">
                <label htmlFor="nd-tel">Téléphone</label>
                <input id="nd-tel" value={form.tel} onChange={set("tel")} placeholder="06 12 34 56 78" />
              </div>
              <div className="op-form-group">
                <label htmlFor="nd-passagers">Nombre de passagers</label>
                <input id="nd-passagers" type="number" min={1} value={form.passagers} onChange={set("passagers")} placeholder="45" />
              </div>
            </div>

            <div className="op-form-row">
              <div className="op-form-group">
                <label htmlFor="nd-depart">Départ *</label>
                <input id="nd-depart" required value={form.depart} onChange={set("depart")} placeholder="Paris" />
              </div>
              <div className="op-form-group">
                <label htmlFor="nd-destination">Destination *</label>
                <input id="nd-destination" required value={form.destination} onChange={set("destination")} placeholder="Lyon" />
              </div>
            </div>

            <div className="op-form-row">
              <div className="op-form-group">
                <label htmlFor="nd-date">Date du trajet</label>
                <input id="nd-date" value={form.tripDate} onChange={set("tripDate")} placeholder="15 juillet 2026" />
              </div>
              <div className="op-form-group">
                <label htmlFor="nd-vehicule">Véhicule souhaité</label>
                <select id="nd-vehicule" value={form.vehicule} onChange={set("vehicule")}>
                  <option value="">À déterminer</option>
                  <option value="Autocar grand tourisme">Autocar grand tourisme</option>
                  <option value="Minibus & van">Minibus &amp; van</option>
                  <option value="Bus privé & VIP">Bus privé &amp; VIP</option>
                </select>
              </div>
            </div>

            <div className="op-form-group">
              <label htmlFor="nd-message">Détails de la demande</label>
              <textarea id="nd-message" rows={3} value={form.message} onChange={set("message")} placeholder="Séminaire d'entreprise, aller-retour dans la journée..." />
            </div>

            <div className="rgpd-consent">
              <label>
                <input
                  type="checkbox"
                  checked={form.rgpdConsent}
                  onChange={e => setForm(f => ({ ...f, rgpdConsent: e.target.checked }))}
                />
                <span>
                  J’accepte que NeoTravel traite mes données personnelles afin de répondre à ma
                  demande de devis, conformément à la{" "}
                  <Link href="/confidentialite">Politique de confidentialité</Link>.
                </span>
              </label>
            </div>

            {error && <p className="op-modal-error">{error}</p>}
          </div>

          <div className="op-modal-footer">
            <button type="button" className="table-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="table-btn lime" disabled={!isValid || submitting}>
              {submitting ? "Envoi..." : "Envoyer la demande"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Dashboard({
  setScreen,
  demandes,
  now,
  selectDemande,
  handleRelance,
}: {
  setScreen: (s: Screen) => void;
  demandes: Demande[];
  now: Date;
  selectDemande: (demandeId: string) => void;
  handleRelance: (demandeId: string) => void;
}) {
  const totalDemandes = demandes.length;
  const demandesNouvelles = demandes.filter(d => d.statut === "Nouveau").length;
  const demandesEnCours = demandes.filter(d => d.statut === "En cours").length;
  const devisEnvoyes = demandes.filter(d => d.statut === "Devis envoyé").length;
  const demandesEnAttente = demandes.filter(d => d.statut === "En attente").length;
  const demandesAcceptees = demandes.filter(d => d.statut === "Accepté").length;
  const chiffreAffairesEstime = demandes.reduce((sum, d) => sum + d.tarifMax, 0);
  const tauxConversion = totalDemandes
    ? Math.round(((devisEnvoyes + demandesAcceptees) / totalDemandes) * 100)
    : 0;

  const priced = demandes.filter(d => d.tarifMax > 0);
  const tarifMoyen = priced.length
    ? Math.round(priced.reduce((sum, d) => sum + (d.tarifMin + d.tarifMax) / 2, 0) / priced.length)
    : 0;
  const tarifMin = priced.length ? Math.min(...priced.map(d => d.tarifMin)) : 0;
  const tarifMax = priced.length ? Math.max(...priced.map(d => d.tarifMax)) : 0;

  const stats = [
    { label: "Demandes reçues", value: String(totalDemandes), caption: `${demandesNouvelles} nouvelle${demandesNouvelles === 1 ? "" : "s"}`, icon: <IcoChatBubble />, tone: "blue" },
    { label: "Devis envoyés", value: String(devisEnvoyes), caption: `${demandesEnCours} en cours`, icon: <IcoSend2 />, tone: "indigo" },
    { label: "Taux de conversion", value: `${tauxConversion} %`, caption: `${demandesEnAttente} en attente`, icon: <IcoCheckCircle2 />, tone: "green" },
    { label: "Chiffre d'affaires estimé", value: `${chiffreAffairesEstime.toLocaleString("fr-FR")} €`, caption: `Tarif moyen ${tarifMoyen.toLocaleString("fr-FR")} €`, icon: <IcoCoins />, tone: "orange" },
  ];

  const activities = [...demandes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);

  const pipelineColors: Partial<Record<DemandeStatus, string>> = {
    "Nouveau": "#dbeafe",
    "En cours": "#bfdbfe",
    "Devis envoyé": "#ddf4ff",
    "En attente": "#fef3c7",
  };
  const pipeline = (["Nouveau", "En cours", "Devis envoyé", "En attente"] as DemandeStatus[]).map(label => ({
    label,
    value: demandes.filter(d => d.statut === label).length,
    color: pipelineColors[label],
  }));

  const followups = demandes.filter(d => d.statut === "En attente" || d.statut === "En relance").slice(0, 2);

  const goToDemande = (demandeId: string) => {
    selectDemande(demandeId);
    setScreen("demandes");
  };

  return (
    <section className="operator-content dashboard-page">
      <div className="dashboard-summary-cards">
        {stats.map(stat => (
          <div key={stat.label} className="dashboard-summary-card">
            <div className={`dashboard-summary-icon ${stat.tone}`}>{stat.icon}</div>
            <div>
              <span className="dashboard-summary-label">{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.caption}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <div className="panel-head">
            <div>
              <h2>Activité récente</h2>
              <p>Demandes clients récentes à traiter</p>
            </div>
            <button className="table-btn" onClick={() => setScreen("demandes")}>Voir toutes</button>
          </div>
          <div className="activity-list">
            {activities.map(item => (
              <button key={item.id} type="button" className="activity-item" onClick={() => goToDemande(item.id)}>
                <div className="activity-avatar">{initials(item.prospect)}</div>
                <div className="activity-info">
                  <div className="activity-top">
                    <strong>{item.prospect}</strong>
                    <span>{formatDayLabel(item.createdAt, now)}</span>
                  </div>
                  <p>{item.id}</p>
                  <p className="activity-route">{item.depart} → {item.destination}</p>
                  <p className="activity-preview">{item.messages[0]?.text ?? "Aucun message pour le moment."}</p>
                </div>
                <span className={`badge ${statusBadgeClass(item.statut)}`}>{item.statut}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="dashboard-right-panel">
          <section className="panel pipeline-panel">
            <div className="panel-head">
              <div>
                <h2>Pipeline</h2>
                <p>Vue d’ensemble des statuts</p>
              </div>
            </div>
            <div className="pipeline-list">
              {pipeline.map(item => (
                <div key={item.label} className="pipeline-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <div className="pipeline-bar" style={{ background: item.color, width: `${item.value * 16 || 4}px` }} />
                </div>
              ))}
            </div>
          </section>

          <section className="panel tariff-card">
            <div className="tariff-card-content">
              <span>TARIF MOYEN</span>
              <strong>{tarifMoyen.toLocaleString("fr-FR")} €</strong>
              <p>par demande · ce mois</p>
              <div className="tariff-meta">
                <span>Min {tarifMin.toLocaleString("fr-FR")} €</span>
                <span>Max {tarifMax.toLocaleString("fr-FR")} €</span>
                <span>Conv. {tauxConversion} %</span>
              </div>
            </div>
          </section>

          <section className="panel followups-panel">
            <div className="panel-head">
              <div>
                <h2>Relances à faire</h2>
                <p>Clients à recontacter</p>
              </div>
            </div>
            {followups.map(item => (
              <div key={item.id} className="followup-item" onClick={() => goToDemande(item.id)}>
                <div>
                  <strong>{item.prospect}</strong>
                  <span>{item.depart} → {item.destination}</span>
                </div>
                <button
                  type="button"
                  className="table-btn lime"
                  onClick={e => {
                    e.stopPropagation();
                    handleRelance(item.id);
                  }}
                >
                  Relancer
                </button>
              </div>
            ))}
          </section>
        </div>
      </div>

      <p className="privacy-note">Données confidentielles — accès réservé aux utilisateurs autorisés.</p>
    </section>
  );
}

type TabKey = "all" | DemandeStatus;

function Demandes({
  demandes,
  now,
  selectDemande,
  getSelectedDemande,
  handleRelance,
  handleGenerateDevis,
  handleExport,
  generatingDevisId,
}: {
  demandes: Demande[];
  now: Date;
  selectDemande: (demandeId: string) => void;
  getSelectedDemande: () => Demande | undefined;
  handleRelance: (demandeId: string) => void;
  handleGenerateDevis: (demandeId: string) => void;
  handleExport: (demandeId: string) => void;
  generatingDevisId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "Toutes", count: demandes.length },
    { key: "Nouveau", label: "Nouvelles", count: demandes.filter(d => d.statut === "Nouveau").length },
    { key: "En cours", label: "En cours", count: demandes.filter(d => d.statut === "En cours").length },
    { key: "Devis envoyé", label: "Devis envoyé", count: demandes.filter(d => d.statut === "Devis envoyé").length },
    { key: "En attente", label: "En attente", count: demandes.filter(d => d.statut === "En attente").length },
  ];

  const filtered = demandes.filter(item => {
    const matchesTab = activeTab === "all" || item.statut === activeTab;
    const q = search.toLowerCase();
    const matchesSearch = !q || item.prospect.toLowerCase().includes(q) || `${item.depart} ${item.destination}`.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const globalSelected = getSelectedDemande();
  const selected = filtered.find(item => item.id === globalSelected?.id) ?? filtered[0] ?? demandes[0];

  if (!selected) {
    return (
      <section className="operator-content demandes-page">
        <p>Aucune demande pour le moment.</p>
      </section>
    );
  }

  return (
    <section className="operator-content demandes-page">
      <div className="demandes-grid">
        <aside className="demandes-sidebar">
          <div className="demandes-header">
            <div>
              <h2>Demandes</h2>
              <p>{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="badge lime">{demandes.length}</span>
          </div>

          <div className="tabs demandes-tabs">
            {tabs.map(t => (
              <button
                key={t.key}
                className={activeTab === t.key ? "active" : ""}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label} <span>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="demandes-search">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
            />
          </div>

          <div className="demandes-list">
            {filtered.map(item => (
              <button
                key={item.id}
                type="button"
                className={`demande-item ${item.id === selected.id ? "active" : ""}`}
                onClick={() => selectDemande(item.id)}
              >
                <div className="demande-avatar">{initials(item.prospect)}</div>
                <div>
                  <div className="demande-meta">
                    <strong>{item.prospect}</strong>
                    <span>{formatDayLabel(item.createdAt, now)}</span>
                  </div>
                  <p className="demande-subtitle">{item.depart} → {item.destination}</p>
                  <p className="demande-preview">{item.messages[0]?.text ?? "Aucun message pour le moment."}</p>
                </div>
                <span className={`badge ${statusBadgeClass(item.statut)}`}>{item.statut}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="demandes-detail">
          <section className="detail-panel">
            <div className="detail-top-row">
              <div>
                <span className="detail-ref">{selected.id}</span>
                <span className={`badge ${statusBadgeClass(selected.statut)}`}>{selected.statut}</span>
              </div>
              <div className="detail-actions">
                <button type="button" className="table-btn dark" onClick={() => handleRelance(selected.id)}>
                  <IcoRefresh />Relancer
                </button>
                <button
                  type="button"
                  className="table-btn lime"
                  onClick={() => handleGenerateDevis(selected.id)}
                  disabled={generatingDevisId === selected.id}
                >
                  <IcoFile />Voir le devis
                </button>
                <button type="button" className="table-btn" onClick={() => handleExport(selected.id)}>
                  <IcoExport />Exporter
                </button>
              </div>
            </div>
            <h2>{selected.prospect}</h2>
            <p className="detail-route">{selected.depart} → {selected.destination}</p>

            <div className="detail-grid">
              <section className="panel client-info-panel">
                <h3>Informations client</h3>
                <div className="client-info-row"><span>Email</span><strong>{selected.email || "—"}</strong></div>
                <div className="client-info-row"><span>Tél.</span><strong>{selected.tel || "—"}</strong></div>
                <div className="client-info-row"><span>Passagers</span><strong>{selected.passagers ? `${selected.passagers} personnes` : "—"}</strong></div>
                <div className="client-info-row"><span>Date</span><strong>{selected.tripDate}</strong></div>
                <div className="client-info-row"><span>Véhicule</span><strong>{selected.vehicule}</strong></div>
                <div className="client-info-row"><span>Distance</span><strong>{selected.distanceKm != null ? formatDistance(selected.distanceKm) : "—"}</strong></div>
              </section>

              <section className="panel tariff-panel">
                <span className="detail-label">Tarif indicatif</span>
                {selected.tarifMax > 0 ? (
                  <>
                    <strong>{selected.tarifMin.toLocaleString("fr-FR")} €</strong>
                    <p>à {selected.tarifMax.toLocaleString("fr-FR")} € TTC</p>
                  </>
                ) : (
                  <strong>À calculer</strong>
                )}
                <small>Tarif indicatif — distance à confirmer avant envoi.</small>
              </section>
            </div>
          </section>

          <section className="panel conversation-panel">
            <div className="panel-head">
              <div>
                <h2>Conversation agent IA</h2>
                <p>{selected.messages.length} messages · {formatDayLabel(selected.createdAt, now)}</p>
              </div>
            </div>
            <div className="agent-conversation demandes-conversation">
              {selected.messages.map((m, i) => (
                <div key={i} className={`message-row ${m.role}`}>
                  {m.role === "agent" && <div className="agent-avatar">Nt</div>}
                  <div className={`message-bubble ${m.role}`}>
                    <p>{m.text}</p>
                    <small className="message-meta">{formatTime(m.sentAt)}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="note-input">
              <textarea placeholder="Ajouter une note..." rows={3} />
            </div>
          </section>
        </main>
      </div>

      <p className="privacy-note">Données confidentielles — accès réservé aux utilisateurs autorisés.</p>
    </section>
  );
}
