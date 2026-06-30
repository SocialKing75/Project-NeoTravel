"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const STORAGE_KEY = "neotravel_cookie_consent";

type CookieChoice = {
  necessary: true;
  analytics: boolean;
  choice: "accepted" | "refused" | "customized";
  savedAt: string;
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredChoice() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Pas de localStorage côté serveur : on ne montre jamais la bannière au rendu serveur,
// useSyncExternalStore la fera apparaître après hydratation si aucun choix n'existe.
function getServerSnapshot() {
  return "ssr-no-banner";
}

function saveChoice(choice: CookieChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // localStorage indisponible (navigation privée, etc.) : le choix ne sera pas mémorisé.
  }
}

export default function CookieBanner() {
  const storedChoice = useSyncExternalStore(subscribe, getStoredChoice, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const visible = !dismissed && storedChoice === null;

  const close = () => {
    setDismissed(true);
    setCustomizing(false);
  };

  const accept = () => {
    saveChoice({ necessary: true, analytics: true, choice: "accepted", savedAt: new Date().toISOString() });
    close();
  };

  const refuse = () => {
    saveChoice({ necessary: true, analytics: false, choice: "refused", savedAt: new Date().toISOString() });
    close();
  };

  const saveCustom = () => {
    saveChoice({
      necessary: true,
      analytics: analyticsEnabled,
      choice: "customized",
      savedAt: new Date().toISOString(),
    });
    close();
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Préférences cookies">
      <div className="cookie-banner-body">
        <p>
          NeoTravel utilise des cookies nécessaires au fonctionnement du site et, si vous
          l’acceptez, des cookies de mesure d’audience. Vous pouvez accepter, refuser ou
          personnaliser votre choix à tout moment. <Link href="/cookies">En savoir plus</Link>.
        </p>

        {customizing && (
          <div className="cookie-banner-options">
            <label>
              <input type="checkbox" checked readOnly />
              <span>Cookies nécessaires (toujours actifs)</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={e => setAnalyticsEnabled(e.target.checked)}
              />
              <span>Cookies de mesure d’audience</span>
            </label>
          </div>
        )}
      </div>

      <div className="cookie-banner-actions">
        {customizing ? (
          <button type="button" className="table-btn lime" onClick={saveCustom}>
            Enregistrer mes choix
          </button>
        ) : (
          <>
            <button type="button" className="table-btn" onClick={refuse}>Refuser</button>
            <button type="button" className="table-btn" onClick={() => setCustomizing(true)}>Personnaliser</button>
            <button type="button" className="table-btn lime" onClick={accept}>Accepter</button>
          </>
        )}
      </div>
    </div>
  );
}
