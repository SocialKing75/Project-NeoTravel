from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import date
import httpx
from pricing_engine import calculate_price

app = FastAPI(title="NeoTravel Pricing API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class DevisRequest(BaseModel):
    ville_depart: str = Field(..., example="Paris")
    ville_arrivee: str = Field(..., example="Lyon")
    date_depart: date = Field(..., example="2026-07-10")
    aller_retour: bool = Field(..., example=False)
    passagers: int = Field(..., ge=1, le=85, example=45)


class DevisResponse(BaseModel):
    ville_depart: str
    ville_arrivee: str
    distance_km: int
    tarif_base_forfait: float
    cout_de_revient: float
    prix_ht: float
    prix_ttc: float
    details_coefficients: dict


class DevisDistanceRequest(BaseModel):
    distance_km: int = Field(..., ge=1, example=450)
    aller_retour: bool = Field(..., example=False)
    saison: str = Field(..., example="Haute")
    days_to_departure: int = Field(..., ge=0, example=30)
    capacity: int = Field(..., ge=1, le=85, example=45)


async def geocode(ville: str) -> tuple[float, float]:
    url = "https://nominatim.openstreetmap.org/search"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            url,
            params={"q": ville + ", France", "format": "json", "limit": 1},
            headers={"User-Agent": "NeoTravel-PricingAPI/1.0"},
        )
        data = r.json()
        if not data:
            raise HTTPException(status_code=422, detail=f"Ville introuvable : {ville}")
        return float(data[0]["lat"]), float(data[0]["lon"])


async def get_road_distance_km(ville_depart: str, ville_arrivee: str) -> int:
    lat1, lon1 = await geocode(ville_depart)
    lat2, lon2 = await geocode(ville_arrivee)
    url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
        data = r.json()
        if data.get("code") != "Ok":
            raise HTTPException(status_code=502, detail="Impossible de calculer la distance routière.")
        distance_m = data["routes"][0]["distance"]
        return round(distance_m / 1000)


def get_saison(d: date) -> str:
    mois = d.month
    if mois in (6, 7, 8, 12):
        return "Haute"
    if mois in (4, 5, 9, 10):
        return "Moyenne"
    return "Basse"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/calculer-devis")
async def calculer_devis_distance(req: DevisDistanceRequest):
    """Route utilisée par le nœud n8n calculerDevis (distance déjà calculée via Nominatim+OSRM)."""
    if req.capacity > 85:
        raise HTTPException(
            status_code=422,
            detail="Capacité > 85 passagers : flux manuel requis, contactez un chargé d'affaires."
        )
    result = await calculate_price(
        distance_km=req.distance_km,
        aller_retour=req.aller_retour,
        saison=req.saison,
        days_to_departure=req.days_to_departure,
        capacity=req.capacity,
    )
    return {"status": "success", "data": result}


@app.post("/calculer", response_model=DevisResponse)
async def calculer_devis(req: DevisRequest):
    if req.passagers > 85:
        raise HTTPException(
            status_code=422,
            detail="Capacité > 85 passagers : flux manuel requis, contactez un chargé d'affaires."
        )

    distance_km = await get_road_distance_km(req.ville_depart, req.ville_arrivee)

    today = date.today()
    days_to_departure = (req.date_depart - today).days
    if days_to_departure < 0:
        raise HTTPException(status_code=422, detail="La date de départ est dans le passé.")

    saison = get_saison(req.date_depart)

    result = await calculate_price(
        distance_km=distance_km,
        aller_retour=req.aller_retour,
        saison=saison,
        days_to_departure=days_to_departure,
        capacity=req.passagers,
    )

    return DevisResponse(
        ville_depart=req.ville_depart,
        ville_arrivee=req.ville_arrivee,
        distance_km=distance_km,
        **result,
    )
