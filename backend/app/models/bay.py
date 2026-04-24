"""SQLAlchemy models for the bays and bay_restrictions tables."""

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text, Time

from app.core.db import Base


class Bay(Base):
    __tablename__ = "bays"

    bay_id = Column(String, primary_key=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    has_restriction_data = Column(Boolean, nullable=False, default=False)
    has_signage_gap = Column(Boolean, nullable=False, default=False)


class BayRestriction(Base):
    __tablename__ = "bay_restrictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bay_id = Column(String, ForeignKey("bays.bay_id"), nullable=False, index=True)
    slot_num = Column(Integer, nullable=False)
    typedesc = Column(String)
    fromday = Column(Integer, nullable=False)
    today = Column(Integer, nullable=False)
    starttime = Column(Time, nullable=False)
    endtime = Column(Time, nullable=False)
    duration_mins = Column(Integer, nullable=True)
    disabilityext_mins = Column(Integer, nullable=True)
    exemption = Column(String, nullable=True)
    plain_english = Column(Text, nullable=False)
    is_strict = Column(Boolean, nullable=False, default=False)
    rule_category = Column(String, nullable=False, default="other")
