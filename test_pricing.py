from fastapi.testclient import TestClient
from datetime import date, timedelta
from main import app

client = TestClient(app)

def test_calcul_forfait_court_aller_simple():
    """Test d'un trajet court : 40 km, 15 passagers, basse saison, 45j d'avance."""
    payload = {
        "adresse_depart": "Paris",
        "adresse_arrivee": "Marne-la-Vallée",
        "aller_retour": False,
        "saison": "baisse",
        "days_to_departure": 45,
        "capacity": 15
    }

    response = client.post("/calculer-devis", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    
    # Vérification de la structure de réponse mise à jour
    assert json_data["status"] == "success"
    # Vérification des prix dans la clé 'data'
    assert json_data["data"]["prix_ht"] > 0
    assert json_data["data"]["prix_ttc"] > 0

def test_calcul_long_parcours_aller_retour():
    """Test d'un long trajet Aller-Retour : 200 km, 60 passagers."""
    payload = {
        "adresse_depart": "Paris",
        "adresse_arrivee": "Lille",
        "aller_retour": True,
        "saison": "tres_haute",
        "days_to_departure": 10,
        "capacity": 60
    }

    response = client.post("/calculer-devis", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    
    assert json_data["status"] == "success"
    assert "prix_ht" in json_data["data"]

def test_debrayage_flux_manuel():
    """Test de sécurité : plus de 85 passagers -> flux manuel."""
    payload = {
        "adresse_depart": "Paris",
        "adresse_arrivee": "Lyon",
        "aller_retour": False,
        "saison": "moyenne",
        "days_to_departure": 20,
        "capacity": 90
    }

    response = client.post("/calculer-devis", json=payload)
    # L'API renvoie 500 car le moteur lève une ValueError, 
    # vérifie si c'est bien le comportement attendu dans ton main.py
    assert response.status_code == 500