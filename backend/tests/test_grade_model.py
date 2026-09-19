"""Tests for the badge grade model (spec §11).

The grade (Platinum/Gold/Silver/Bronze/Failed) is derived from the signed
trust_score + critical count, layered on top of the existing tier without
changing certification logic.
"""
from __future__ import annotations

from agent_audit.certificate import grade_for


class TestGradeBands:
    def test_platinum(self):
        assert grade_for(97, 0) == "PLATINUM"
        assert grade_for(95, 0) == "PLATINUM"

    def test_gold(self):
        assert grade_for(94, 0) == "GOLD"
        assert grade_for(90, 0) == "GOLD"

    def test_silver(self):
        assert grade_for(89, 0) == "SILVER"
        assert grade_for(80, 0) == "SILVER"

    def test_bronze(self):
        assert grade_for(79, 0) == "BRONZE"
        assert grade_for(70, 0) == "BRONZE"

    def test_failed_below_70(self):
        assert grade_for(69, 0) == "FAILED"
        assert grade_for(0, 0) == "FAILED"

    def test_critical_forces_failed_regardless_of_score(self):
        # The spec's hard rule: a critical failure blocks certification even at
        # a high score. The grade must reflect that.
        assert grade_for(100, 1) == "FAILED"
        assert grade_for(96, 5) == "FAILED"

    def test_boundaries_are_inclusive(self):
        # exact thresholds land in the higher band
        assert grade_for(95, 0) == "PLATINUM"
        assert grade_for(90, 0) == "GOLD"
        assert grade_for(80, 0) == "SILVER"
        assert grade_for(70, 0) == "BRONZE"


class TestCertificateGradeProperty:
    def _cert(self, score, critical):
        from agent_audit.certificate import Certificate
        return Certificate(
            agent_name="a", tier="CERTIFIED", trust_score=score,
            issued_at="2026-01-01T00:00:00Z", expires_at="2026-04-01T00:00:00Z",
            audit_version="9.0.0", cert_version="4.2", audit_id="x",
            content_hash="h", public_key_b64="k", signature_b64="s",
            findings_summary={"critical": critical},
        )

    def test_grade_property_reads_findings_summary(self):
        assert self._cert(96, 0).grade == "PLATINUM"
        assert self._cert(85, 0).grade == "SILVER"
        assert self._cert(99, 2).grade == "FAILED"

    def test_badges_awarded_on_clean_high_score(self):
        badges = self._cert(92, 0).badges
        assert "Production Ready" in badges
        assert "Enterprise Ready" in badges
        assert "Secure Agent" in badges

    def test_badges_withheld_when_critical(self):
        assert self._cert(99, 1).badges == []

    def test_only_secure_badge_at_mid_score(self):
        badges = self._cert(75, 0).badges
        assert badges == ["Secure Agent"]
