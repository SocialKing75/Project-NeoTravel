import pytest
import asyncio
from datetime import date
from pricing_engine import (
    calculate_price,
    get_anticipation_coef,
    get_capacity_coef,
    fetch_pricing_grid,
    fetch_seasonal_coefficients,
)

# ponytail: minimal test suite — focus on deterministic logic and edge cases


class TestAnticipationCoefficient:
    """Test anticipation coefficient logic (days_to_departure)."""

    def test_urgent_14_days_or_less(self):
        """Departure in <= 14 days → +10%"""
        assert get_anticipation_coef(0) == 0.10
        assert get_anticipation_coef(7) == 0.10
        assert get_anticipation_coef(14) == 0.10

    def test_normal_15_to_30_days(self):
        """Departure in 15-30 days → +5%"""
        assert get_anticipation_coef(15) == 0.05
        assert get_anticipation_coef(22) == 0.05
        assert get_anticipation_coef(30) == 0.05

    def test_advance_31_to_90_days(self):
        """Departure in 31-90 days → -5%"""
        assert get_anticipation_coef(31) == -0.05
        assert get_anticipation_coef(60) == -0.05
        assert get_anticipation_coef(90) == -0.05

    def test_early_91_plus_days(self):
        """Departure in >= 91 days → -10%"""
        assert get_anticipation_coef(91) == -0.10
        assert get_anticipation_coef(120) == -0.10
        assert get_anticipation_coef(365) == -0.10


class TestCapacityCoefficient:
    """Test vehicle capacity coefficient logic."""

    def test_small_van_19_or_less(self):
        """Small vehicle (≤19 seats) → -5%"""
        assert get_capacity_coef(1) == -0.05
        assert get_capacity_coef(10) == -0.05
        assert get_capacity_coef(19) == -0.05

    def test_standard_bus_20_to_53(self):
        """Standard bus (20-53 seats) → 0%"""
        assert get_capacity_coef(20) == 0.0
        assert get_capacity_coef(40) == 0.0
        assert get_capacity_coef(53) == 0.0

    def test_large_bus_54_to_63(self):
        """Large bus (54-63 seats) → +15%"""
        assert get_capacity_coef(54) == 0.15
        assert get_capacity_coef(60) == 0.15
        assert get_capacity_coef(63) == 0.15

    def test_extra_large_bus_64_to_67(self):
        """Extra large bus (64-67 seats) → +20%"""
        assert get_capacity_coef(64) == 0.20
        assert get_capacity_coef(65) == 0.20
        assert get_capacity_coef(67) == 0.20

    def test_max_size_bus_68_to_85(self):
        """Max size bus (68-85 seats) → +40%"""
        assert get_capacity_coef(68) == 0.40
        assert get_capacity_coef(75) == 0.40
        assert get_capacity_coef(85) == 0.40

    def test_over_capacity_86_plus_raises_error(self):
        """Capacity > 85 → ValueError (manual commercial flow required)."""
        with pytest.raises(ValueError, match="Capacité supérieure à 85"):
            get_capacity_coef(86)
        with pytest.raises(ValueError):
            get_capacity_coef(100)


@pytest.mark.asyncio
class TestCalculatePrice:
    """Test full pricing calculation logic."""

    async def test_short_distance_forfait_50km(self):
        """Short distance (50 km) → applies fixed tariff from grid."""
        result = await calculate_price(
            distance_km=50,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # Grid default: 50 km = 480 EUR base tariff
        assert result["tarif_base_forfait"] == 480.0
        assert result["prix_ttc"] > 0
        # With coefs: saison=0, anticipation=-5%, capacite=0 → total -5%
        assert result["details_coefficients"]["total_cumule"] == -0.05

    async def test_medium_distance_forfait_150km(self):
        """Medium distance (150 km) → applies forfait rule."""
        result = await calculate_price(
            distance_km=150,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # Grid: 150 km = 890 EUR base tariff
        assert result["tarif_base_forfait"] == 890.0
        assert result["prix_ttc"] > 0

    async def test_aller_retour_doubles_forfait(self):
        """Round trip (≤180 km) → doubles the forfait."""
        result_simple = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        result_retour = await calculate_price(
            distance_km=100,
            aller_retour=True,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # forfait should be 2x for round trip
        assert result_retour["tarif_base_forfait"] == result_simple["tarif_base_forfait"] * 2

    async def test_long_distance_linear_250km(self):
        """Long distance (>180 km) → applies linear formula: distance * 2 * 2.5."""
        result = await calculate_price(
            distance_km=250,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # Linear: 250 * 2 * 2.5 = 1250
        assert result["tarif_base_forfait"] == 1250.0
        assert result["prix_ttc"] > 0

    async def test_long_distance_aller_retour_same_formula(self):
        """Long distance (>180 km) → round trip uses same formula (vehicle travels 2x anyway)."""
        result_simple = await calculate_price(
            distance_km=250,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        result_retour = await calculate_price(
            distance_km=250,
            aller_retour=True,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # For long distance, aller_retour doesn't double (already in formula)
        assert result_simple["tarif_base_forfait"] == result_retour["tarif_base_forfait"]

    async def test_saison_haute_applies_10_percent(self):
        """High season (June, July, August, December) → +10% coefficient."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Haute",
            days_to_departure=30,
            capacity=40,
        )
        # Saison +10%, anticipation -5%, capacite 0% → total +5%
        assert result["details_coefficients"]["saison"] == 0.10
        assert result["details_coefficients"]["total_cumule"] == 0.05

    async def test_saison_basse_applies_neg_5_percent(self):
        """Low season (Jan, Feb, Mar, Nov) → -5% coefficient."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Basse",
            days_to_departure=30,
            capacity=40,
        )
        # Saison -5%, anticipation -5%, capacite 0% → total -10%
        assert result["details_coefficients"]["saison"] == -0.05
        assert result["details_coefficients"]["total_cumule"] == -0.10

    async def test_urgent_departure_adds_10_percent(self):
        """Urgent (≤14 days) → +10% anticipation."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=7,
            capacity=40,
        )
        # Saison 0%, anticipation +10%, capacite 0% → total +10%
        assert result["details_coefficients"]["anticipation"] == 0.10
        assert result["details_coefficients"]["total_cumule"] == 0.10

    async def test_capacity_large_bus_adds_15_percent(self):
        """Large bus (54-63 seats) → +15% coefficient."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=60,
        )
        # Saison 0%, anticipation -5%, capacite +15% → total +10%
        assert result["details_coefficients"]["capacite"] == 0.15
        assert result["details_coefficients"]["total_cumule"] == 0.10

    async def test_margin_applied_15_percent(self):
        """Price HT includes 15% margin."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # prix_ht = cout_de_revient * 1.15
        expected_ht = result["cout_de_revient"] * 1.15
        assert abs(result["prix_ht"] - expected_ht) < 0.01

    async def test_tva_applied_10_percent(self):
        """Price TTC includes 10% VAT."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=30,
            capacity=40,
        )
        # prix_ttc = prix_ht * 1.10
        expected_ttc = result["prix_ht"] * 1.10
        assert abs(result["prix_ttc"] - expected_ttc) < 0.01

    async def test_price_always_positive(self):
        """Price must always be positive regardless of coefficients."""
        result = await calculate_price(
            distance_km=1,
            aller_retour=False,
            saison="Basse",
            days_to_departure=365,
            capacity=10,  # -5% for small van
        )
        # Even with multiple negative coefficients
        assert result["prix_ttc"] > 0
        assert result["prix_ht"] > 0

    async def test_edge_case_1_passenger_small_van(self):
        """Edge: 1 passenger in smallest vehicle."""
        result = await calculate_price(
            distance_km=50,
            aller_retour=False,
            saison="Moyenne",
            days_to_departure=0,
            capacity=1,
        )
        # Small van -5%, no saison, urgent +10% → total +5%
        assert result["details_coefficients"]["capacite"] == -0.05
        assert result["details_coefficients"]["anticipation"] == 0.10
        assert result["prix_ttc"] > 0

    async def test_edge_case_85_passengers_max_bus(self):
        """Edge: max capacity (85) in max bus."""
        result = await calculate_price(
            distance_km=500,
            aller_retour=False,
            saison="Haute",
            days_to_departure=1,
            capacity=85,
        )
        # Max bus +40%, high season +10%, urgent +10% → total +60%
        assert result["details_coefficients"]["capacite"] == 0.40
        assert result["details_coefficients"]["saison"] == 0.10
        assert result["details_coefficients"]["anticipation"] == 0.10
        assert result["prix_ttc"] > 0

    async def test_edge_case_86_passengers_over_capacity(self):
        """Edge: 86 passengers → error (manual flow required)."""
        with pytest.raises(ValueError, match="Capacité supérieure à 85"):
            await calculate_price(
                distance_km=500,
                aller_retour=False,
                saison="Moyenne",
                days_to_departure=30,
                capacity=86,
            )

    async def test_coefficients_cumulative(self):
        """Verify coefficients are cumulative (not multiplicative)."""
        result = await calculate_price(
            distance_km=100,
            aller_retour=False,
            saison="Haute",  # +10%
            days_to_departure=7,  # +10%
            capacity=60,  # +15%
        )
        # Should be additive: 0.10 + 0.10 + 0.15 = 0.35
        assert result["details_coefficients"]["total_cumule"] == 0.35

    async def test_pricing_deterministic(self):
        """Same inputs → same output (deterministic, no randomness)."""
        result1 = await calculate_price(
            distance_km=250,
            aller_retour=True,
            saison="Haute",
            days_to_departure=45,
            capacity=50,
        )
        result2 = await calculate_price(
            distance_km=250,
            aller_retour=True,
            saison="Haute",
            days_to_departure=45,
            capacity=50,
        )
        assert result1["prix_ttc"] == result2["prix_ttc"]


@pytest.mark.asyncio
class TestFallbackBehavior:
    """Test fallback to local grid when Airtable fails."""

    async def test_grid_always_returns_dict(self):
        """Grid fetch should always return a dict (local fallback if Airtable fails)."""
        grid = await fetch_pricing_grid()
        assert isinstance(grid, dict)
        assert len(grid) > 0

    async def test_seasonal_coefs_always_return_dict(self):
        """Seasonal coefficients should always return a dict (local fallback)."""
        coefs = await fetch_seasonal_coefficients()
        assert isinstance(coefs, dict)
        assert "Haute" in coefs or len(coefs) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
