export type DevisRequestPayload = {
  id?: string;
  prospect: string;
  email: string;
  tel?: string;
  depart: string;
  destination: string;
  passagers?: number;
  tripDate?: string;
  vehicule?: string;
  message?: string;
  rgpdConsent?: boolean;
};

export type DevisRequestResponse = {
  success: true;
  distanceKm?: number;
  tarifMin?: number;
  tarifMax?: number;
  totalHT?: number;
  totalTTC?: number;
  message?: string;
};

export async function createDevisRequest(payload: DevisRequestPayload): Promise<DevisRequestResponse> {
  const response = await fetch("/api/devis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Échec de l'envoi de la demande (statut ${response.status}).`);
  }

  return response.json();
}
