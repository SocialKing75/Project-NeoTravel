import os
import httpx
import googlemaps
from dotenv import load_dotenv

load_dotenv()

# Configuration
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}",
    "Content-Type": "application/json"
}

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# --- NOUVELLE FONCTION DE SÉCURITÉ ---
def valider_demande(distance, passagers):
    # Règle 1 : Limite géographique (1 500 km pour couvrir France et pays limitrophes)
    if distance > 1500:
        raise ValueError("Trajet hors zone géographique couverte.")
    
    # Règle 2 : Limite de capacité
    if passagers > 85:
        raise ValueError("Capacité supérieure au seuil autorisé.")

    return True

async def fetch_pricing_grid():
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/Grille_Forfaits"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=HEADERS)
        data = response.json()
        return {int(r["fields"]["Palier_KM"]): float(r["fields"]["Tarif_base_Euros"]) for r in data.get("records", [])}

async def fetch_seasonal_coefficients():
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/Coefficients_Saison"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=HEADERS)
        data = response.json()
        return {r["fields"]["Saison"]: float(r["fields"]["Ajustement"]) for r in data.get("records", [])}

def get_distance_km(origin, destination):
    matrix = gmaps.distance_matrix(origins=origin, destinations=destination, mode='driving', language='fr')
    element = matrix['rows'][0]['elements'][0]
    return int(round(element['distance']['value'] / 1000)) if element['status'] == 'OK' else 0

def get_anticipation_coef(days):
    if days <= 14: return 0.10
    if days <= 30: return 0.05
    if days <= 90: return -0.05
    return -0.10

def get_capacity_coef(capacity):
    if capacity <= 19: return -0.05
    if capacity <= 53: return 0.0
    if capacity <= 63: return 0.15
    if capacity <= 67: return 0.20
    if capacity <= 85: return 0.40
    # Note : Le cas > 85 est maintenant géré par valider_demande()
    raise ValueError("Capacité > 85 : flux manuel requis.")

async def calculate_price(distance_km, aller_retour, saison, days, capacity):
    # --- APPEL DE LA VALIDATION ---
    valider_demande(distance_km, capacity)
    
    grille = await fetch_pricing_grid()
    coeffs = await fetch_seasonal_coefficients()
    
    # Calcul du tarif de base
    palier = next((k for k in sorted(grille.keys()) if k >= distance_km), max(grille.keys()))
    tarif_base = grille[palier]
    base_tarif = tarif_base * (2 if aller_retour else 1)
    
    # Calcul des coefficients
    c_saison = coeffs.get(saison, 0.0)
    c_anticipation = get_anticipation_coef(days)
    c_capacite = get_capacity_coef(capacity)
    total_coef = c_saison + c_anticipation + c_capacite
    
    # Calcul final
    price = base_tarif * (1 + total_coef)
    
    # Retour détaillé pour usage par n8n
    return {
        "tarif_base_forfait": tarif_base,
        "cout_de_revient": round(base_tarif, 2),
        "prix_ht": round(price, 2),
        "prix_ttc": round(price * 1.15 * 1.10, 2),
        "distance_km": distance_km,
        "details_coefficients": {
            "saison": c_saison,
            "anticipation": c_anticipation,
            "capacite": c_capacite,
            "total_cumule": round(total_coef, 2)
        }
    }