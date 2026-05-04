"""Pydantic schemas for bay evaluation endpoints."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class ActiveRestriction(BaseModel):
    typedesc: Optional[str]
    rule_category: str
    plain_english: str
    max_stay_mins: Optional[int] = None
    # ISO-8601 datetime string with Australia/Melbourne offset (+10:00/+11:00)
    expires_at: Optional[str] = None


class StrictWarning(BaseModel):
    rule_id: Optional[int] = None
    type: str
    typedesc: Optional[str]
    # ISO-8601 datetime string with Australia/Melbourne offset (+10:00/+11:00)
    starts_at: str
    minutes_into_stay: int
    description: str


class TranslatorRule(BaseModel):
    """A single plain-English rule segment for the 'Parking Sign Translator' UI."""

    state: Literal["current", "upcoming", "normal", "outside"]
    heading: str
    body: str
    banner: Optional[str] = None


class BayEvaluation(BaseModel):
    bay_id: str
    verdict: str  # "yes" | "no" | "unknown"
    reason: str
    active_restriction: Optional[ActiveRestriction] = None
    warning: Optional[StrictWarning] = None
    # "db" = answered from RDS restriction data
    # "api_fallback" = DB had no data; answered from CoM restriction API cache
    # "unknown" = no data source had useful information
    data_source: str = "db"
    # UI rendering hint:
    #   "full"            = show occupancy + rules (sensor status + DB verdict)
    #   "rules_only"      = show rules with "no live status" (DB/API verdict, no sensor)
    #   "partial_signage" = rules shown but LZ/DP sign not captured — check bay sign
    #   "none"            = show "check signage" (no verdict, no sensor)
    data_coverage: Literal["full", "rules_only", "partial_signage", "none"] = "none"
    street_name: Optional[str] = None
    translator_rules: list[TranslatorRule] = []


class BayVerdictBrief(BaseModel):
    bay_id: str
    lat: Optional[float]
    lon: Optional[float]
    verdict: str
    street_name: Optional[str] = None
