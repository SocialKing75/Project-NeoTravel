from fastapi.testclient import TestClient
from datetime import date, timedelta
from pricing_engine import app

client = TestClient(app)

def test_calcul_forfait_court_aller_simple():
    """Test d'un trajet court (<= 180km) : 40 km, 15 passagers, basse saison, réservé 45 jours à l'avance."""
    payload = {
        "ville_depart": "Paris",
        "ville_arrivee": "Marne-la-Vallée",
        "distance_km": 40,            # Palier 40 km = 320€
        "nombre_passagers": 15,       # Palier <= 19 -> Coeff -5% (-0.05)
        "type_trajet": "aller_simple", # Multiplicateur x1
        "saison": "baisse",           # Coeff -7% (-0.07)
        "date_depart": str(date.today() + timedelta(days=45)) # 45j -> DD_NORMAL = Coeff -5% (-0.05)
    }
    
    response = client.post("/calculer-devis", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["statut"] == "success"
    assert json_data["donnees_calcul"]["profil_anticipation"] == "DD_NORMAL"
    
    # Détail mathématique :
    # Tarif base = 320€
    # Ajustements = -0.05 (capacité) + -0.07 (saison) + -0.05 (anticipation) = -0.17
    # Coût revient = 320 * (1 - 0.17) = 265.60€
    # Prix HT = 265.60 * 1.15 = 305.44€
    # TVA 10% = 30.54€
    # TTC = 335.98€
    
    assert json_data["tarification"]["total_ht"] == 305.44
    assert json_data["tarification"]["tva_10"] == 30.54
    assert json_data["tarification"]["total_ttc"] == 335.98

def test_calcul_long_parcours_aller_retour():
    """Test d'un long trajet (> 180km) en Aller-Retour : 200 km, 60 passagers, très haute saison, réservé 10 jours à l'avance."""
    payload = {
        "ville_depart": "Paris",
        "ville_arrivee": "Lille",
        "distance_km": 200,            # > 180km -> (200 * 2) * 2.5 = 1000€
        "nombre_passagers": 60,       # Palier 54-63 -> Coeff +15% (+0.15)
        "type_trajet": "aller_retour", # Multiplicateur x2 -> 2000€
        "saison": "tres_haute",       # Coeff +15% (+0.15)
        "date_depart": str(date.today() + timedelta(days=10)) # 10j -> DD_PRIORITAIRE = Coeff +10% (+0.10)
    }
    
    response = client.post("/calculer-devis", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    
    # Détail mathématique :
    # Tarif base = 1000€ * 2 (Aller/Retour) = 2000€
    # Ajustements = 0.15 (capacité) + 0.15 (saison) + 0.10 (anticipation) = +0.40
    # Coût revient = 2000 * (1 + 0.40) = 2800€
    # Prix HT = 2800 * 1.15 = 3220.00€
    # TVA 10% = 322.00€
    # TTC = 3542.00€
    
    assert json_data["tarification"]["total_ht"] == 3220.00
    assert json_data["tarification"]["tva_10"] == 322.00
    assert json_data["tarification"]["total_ttc"] == 3542.00

def test_debrayage_flux_manuel():
    """Test de sécurité : plus de 85 passagers doit renvoyer vers le commercial."""
    payload = {
        "ville_depart": "Paris",
        "ville_arrivee": "Lyon",
        "distance_km": 460,
        "nombre_passagers": 90, # > 85 passagers -> Alerte !
        "type_trajet": "aller_simple",
        "saison": "moyenne",
        "date_depart": str(date.today() + timedelta(days=20))
    }
    
    response = client.post("/calculer-devis", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    
    assert json_data["statut"] == "flux_manuel"
    assert "Transmission immédiate au service commercial" in json_data["message"]
    assert "tarification" not in json_data # Pas de prix calculé automatiquement