"""Pydantic schemas for bay evaluation endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class ActiveRestriction(BaseModel):
    typedesc: str | None
    rule_category: str
    plain_english: str
    max_stay_mins: int | None = None
    expires_at: str | None = None


class StrictWarning(BaseModel):
    type: str
    typedesc: str | None
    starts_at: str
    minutes_into_stay: int
    description: str


class BayEvaluation(BaseModel):
    bay_id: str
    verdict: str  # "yes" | "no" | "unknown"
    reason: str
    active_restriction: ActiveRestriction | None = None
    warning: StrictWarning | None = None
    # "db" = answered from RDS restriction data
    # "api_fallback" = DB had no data; answered from CoM restriction API cache
    # "unknown" = no data source had useful information
    data_source: str = "db"


class BayVerdictBrief(BaseModel):
    bay_id: str
    lat: float | None
    lon: float | None
    verdict: str
