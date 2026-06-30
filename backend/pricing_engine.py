import os
import httpx
import math
from dotenv import load_dotenv

# Charger les variables d'environnement du fichier .env
load_dotenv()

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")

HEADERS = {
    "Authorization": f"Bearer {AIRTABLE_API_KEY}",
    "Content-Type": "application/json"
}

FALLBACK_GRID = {50: 480, 100: 680, 150: 890, 180: 1050}
FALLBACK_SAISON = {"Haute": 0.10, "Moyenne": 0.0, "Basse": -0.05}

async def fetch_pricing_grid():
    """Va chercher la grille des tarifs forfaitaires sur Airtable, avec fallback local."""
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
        return FALLBACK_GRID
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/Grille_Forfaits"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(url, headers=HEADERS)
            if response.status_code != 200:
                return FALLBACK_GRID
            data = response.json()
            grid = {}
            for record in data.get("records", []):
                fields = record.get("fields", {})
                km = fields.get("Palier_KM")
                tarif = fields.get("Tarfi_base_Euros")  # Conserve la faute de frappe Airtable
                if km is not None and tarif is not None:
                    grid[int(km)] = float(tarif)
            return grid if grid else FALLBACK_GRID
    except Exception:
        return FALLBACK_GRID

async def fetch_seasonal_coefficients():
    """Va chercher les coefficients d'ajustement des saisons sur Airtable, avec fallback local."""
    if not AIRTABLE_API_KEY or not AIRTABLE_BASE_ID:
        return FALLBACK_SAISON
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/Coefficients_Saison"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(url, headers=HEADERS)
            if response.status_code != 200:
                return FALLBACK_SAISON
            data = response.json()
            coefficients = {}
            for record in data.get("records", []):
                fields = record.get("fields", {})
                saison = fields.get("Saison")
                ajustement = fields.get("Ajustement")
                if saison is not None and ajustement is not None:
                    coefficients[saison] = float(ajustement)
            return coefficients if coefficients else FALLBACK_SAISON
    except Exception:
        return FALLBACK_SAISON

def get_anticipation_coef(days_to_departure: int) -> float:
    """Retourne le coefficient selon le délai d'anticipation"""
    if days_to_departure <= 14:
        return 0.10  # +10%
    elif days_to_departure <= 30:
        return 0.05  # +5%
    elif days_to_departure <= 90:
        return -0.05 # -5%
    else:
        return -0.10 # -10%

def get_capacity_coef(capacity: int) -> float:
    """Retourne le coefficient selon la capacité du véhicule"""
    if capacity <= 19:
        return -0.05  # -5%
    elif capacity <= 53:
        return 0.0    # 0%
    elif capacity <= 63:
        return 0.15   # +15%
    elif capacity <= 67:
        return 0.20   # +20%
    elif capacity <= 85:
        return 0.40   # +40%
    else:
        raise ValueError("Capacité supérieure à 85 : Envoi requis au commercial (flux manuel).")

async def calculate_price(distance_km: int, aller_retour: bool, saison: str, days_to_departure: int, capacity: int):
    """
    Calcule le coût de revient, le prix HT (avec marge) et le prix TTC.
    """
    # 1. Récupération des données dynamiques d'Airtable
    grille_tarifs = await fetch_pricing_grid()
    coefficients_saison = await fetch_seasonal_coefficients()
    
    # 2. Détermination du tarif forfaitaire de base
    if distance_km <= 180:
        paliers_disponibles = sorted([km for km in grille_tarifs.keys() if km >= distance_km])
        if not paliers_disponibles:
            paliers_disponibles = [max(grille_tarifs.keys())] 
        meilleur_palier = paliers_disponibles[0]
        base_tarif = grille_tarifs[meilleur_palier]
        
        # L'Aller/Retour ne s'applique que sur la grille forfaitaire <= 180 KM
        if aller_retour:
            base_tarif = base_tarif * 2
            
    else:
        # RÈGLE > 180 KM : Le retour à vide est déjà inclus dans la formule (KM * 2)
        # Que ce soit un Aller Simple ou un Aller/Retour, le véhicule parcourt la distance deux fois.
        base_tarif = (distance_km * 2) * 2.5
        
    # 3. Récupération des coefficients additionnels
    coef_saison = coefficients_saison.get(saison, 0.0) 
    coef_anticipation = get_anticipation_coef(days_to_departure)
    coef_capacite = get_capacity_coef(capacity)
    
    # Cumul des pondérations
    total_coefficients = coef_saison + coef_anticipation + coef_capacite
    
    # Calcul du coût de revient ajusté
    cost_price = base_tarif * (1 + total_coefficients)
    
    # 4. Application de la marge (15%) et calcul des prix finaux
    marge_rate = 0.15
    prix_ht = cost_price * (1 + marge_rate)
    tva_rate = 0.10  # TVA à 10%
    prix_ttc = prix_ht * (1 + tva_rate)
    
    return {
        "tarif_base_forfait": round(base_tarif, 2),
        "cout_de_revient": round(cost_price, 2),
        "prix_ht": round(prix_ht, 2),
        "prix_ttc": round(prix_ttc, 2),
        "details_coefficients": {
            "saison": coef_saison,
            "anticipation": coef_anticipation,
            "capacite": coef_capacite,
            "total_cumule": round(total_coefficients, 2)
        }
    }

# --- Section de Test Global ---
if __name__ == "__main__":
    import asyncio
    
    async def simulation():
        try:
            print("--- Simulation de calcul de devis ---")
            # Exemple d'un long trajet : 250 KM
            resultat = await calculate_price(
                distance_km=250, 
                aller_retour=False, 
                saison="Haute", 
                days_to_departure=20, 
                capacity=50
            )
            import json
            print(json.dumps(resultat, indent=4, ensure_ascii=False))
            
        except Exception as e:
            print(f"Erreur lors du calcul : {e}")

    asyncio.run(simulation())