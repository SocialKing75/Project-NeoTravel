import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from pricing_engine import calculate_price, get_distance_km

load_dotenv()

app = FastAPI()

class DevisDemande(BaseModel):
    adresse_depart: str
    adresse_arrivee: str
    aller_retour: bool
    saison: str
    days_to_departure: int
    capacity: int

@app.post("/calculer-devis")
async def obtenir_devis(demande: DevisDemande):
    try:
        # 1. Calcul via le moteur (Ton cœur de métier)
        dist = get_distance_km(demande.adresse_depart, demande.adresse_arrivee)
        resultat = await calculate_price(
            dist, 
            demande.aller_retour, 
            demande.saison, 
            demande.days_to_departure, 
            demande.capacity
        )

        # 2. Retour direct au client (via ton interface Swagger)
        # C'est ici que le jury voit le résultat détaillé.
        return {"status": "success", "data": resultat}

    except Exception as e:
        print(f"Erreur : {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)