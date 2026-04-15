"""Pydantic schemas for bay evaluation endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ActiveRestriction(BaseModel):
    typedesc: Optional[str]
    rule_category: str
    plain_english: str
    max_stay_mins: Optional[int] = None
    expires_at: Optional[str] = None


class StrictWarning(BaseModel):
    type: str
    typedesc: Optional[str]
    starts_at: str
    minutes_into_stay: int
    description: str


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


class BayVerdictBrief(BaseModel):
    bay_id: str
    lat: Optional[float]
    lon: Optional[float]
    verdict: str
