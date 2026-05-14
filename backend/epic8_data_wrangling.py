import asyncio, duckdb, httpx
from pathlib import Path
from math import radians, sin, cos, atan2, sqrt
from datetime import datetime

DB_PATH = "melopark.duckdb"
SCHEMA_PATH = "app/core/schema.sql"
CBD_LAT, CBD_LON = -37.8136, 144.9631
EF = 193.7
BASELINE_KM = 2.0
BASELINE_G = BASELINE_KM * EF
COM = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"

def hav(la1,lo1,la2,lo2):
    R=6371000; dl=radians(la2-la1); dlo=radians(lo2-lo1)
    a=sin(dl/2)**2+cos(radians(la1))*cos(radians(la2))*sin(dlo/2)**2
    return int(R*2*atan2(sqrt(a),sqrt(1-a)))

def score(occ,hour):
    peak=(7<=hour<=9)or(17<=hour<=19)
    sk=min(BASELINE_KM,(0.05+(occ/100)*1.95)*(1.35 if peak else 1.0))
    sg=max(0,(BASELINE_KM-sk)*EF)
    sg=max(sg,BASELINE_G*0.10)
    pct=round((sg/BASELINE_G)*100)
    sc=min(100,round((sg/BASELINE_G*0.75+(occ/100)*0.25)*100))
    return int(sg),pct,sc

async def fetch(url,params=None):
    async with httpx.AsyncClient(timeout=120) as c:
        r=await c.get(url,params=params or {})
        d=r.json()
        return d if isinstance(d,list) else d.get("results",[])

async def main():
    print("="*50+"\nEpic 8 — Data wrangling pipeline\n"+"="*50)
    con=duckdb.connect(DB_PATH)
    try:
        con.execute(Path(SCHEMA_PATH).read_text())
        print("✓ Schema created")

        sensors=await fetch(f"{COM}/on-street-parking-bay-sensors/exports/json",{"limit":-1})
        rows=[(str(r.get("kerbsideid")),r.get("status_description",""),
               float((r.get("location")or{}).get("lat",0)),
               float((r.get("location")or{}).get("lon",0)))
              for r in sensors if r.get("kerbsideid") and (r.get("location")or{}).get("lat")]
        if rows:
            con.executemany("INSERT INTO sensor_raw (marker_id,status,lat,lon) VALUES (?,?,?,?)",rows)
        print(f"✓ Bronze — {len(rows)} sensors")

        bays_raw=await fetch(f"{COM}/on-street-parking-bays/exports/json",{"limit":-1})
        bmap={str(r["kerbsideid"]):{"street":r.get("roadsegmentdescription",""),
              "lat":float(r.get("latitude",0)or 0),"lon":float(r.get("longitude",0)or 0)}
              for r in bays_raw if r.get("kerbsideid")}
        print(f"✓ Loaded {len(bmap)} bay geometries")

        # Street-level occupancy grouping
        segs={}
        for mid,st,lat,lon in rows:
            bay=bmap.get(mid,{}); seg=bay.get("street") or f"{round(lat,3)},{round(lon,3)}"
            if seg not in segs: segs[seg]={"total":0,"occ":0,"bays":[]}
            segs[seg]["total"]+=1
            if st.lower() in("present","occupied"): segs[seg]["occ"]+=1
            segs[seg]["bays"].append((mid,lat,lon))

        hour=datetime.now().hour
        srows=[]
        for seg,d in segs.items():
            op=round((d["occ"]/d["total"])*100) if d["total"]>0 else 50
            for mid,lat,lon in d["bays"]:
                b=bmap.get(mid,{}); bl=b.get("lat") or lat; blo=b.get("lon") or lon
                srows.append((mid,mid,op,hav(bl,blo,CBD_LAT,CBD_LON),hour))

        con.executemany("""INSERT INTO bay_occupancy (bay_id,marker_id,occ_pct,walk_m,hour_of_day,updated_at)
            VALUES(?,?,?,?,?,current_timestamp) ON CONFLICT(bay_id) DO UPDATE SET
            occ_pct=excluded.occ_pct,walk_m=excluded.walk_m,
            hour_of_day=excluded.hour_of_day,updated_at=excluded.updated_at""",srows)
        print(f"✓ Silver — {len(srows)} bays with street-level occupancy")

        silver=con.execute("SELECT bay_id,occ_pct,walk_m FROM bay_occupancy").fetchall()
        grows=[(bid,)+score(op,hour) for bid,op,wm in silver]
        con.executemany("""INSERT INTO carbon_score (bay_id,saved_g,pct_avoided,score,scored_at)
            VALUES(?,?,?,?,current_timestamp) ON CONFLICT(bay_id) DO UPDATE SET
            saved_g=excluded.saved_g,pct_avoided=excluded.pct_avoided,
            score=excluded.score,scored_at=excluded.scored_at""",grows)
        print(f"✓ Gold — {len(grows)} bays scored")
        con.commit()

        try:
            from app.core.db import SessionLocal
            from app.models.bay import Bay
            db=SessionLocal(); upd=0
            for mid,b in bmap.items():
                if b["street"]: upd+=db.query(Bay).filter(Bay.bay_id==mid).update({"street_name":b["street"]})
            db.commit(); db.close()
            print(f"✓ PostgreSQL — {upd} street names updated")
        except Exception as e: print(f"⚠ PostgreSQL skipped: {e}")

        total=con.execute("SELECT COUNT(*) FROM carbon_score").fetchone()[0]
        print("="*50+f"\nDone — {total} bays scored\n"+"="*50)
    finally: con.close()

asyncio.run(main())
def build_silver(con, sensor_rows, bay_map):
    from datetime import datetime
    hour = datetime.now().hour

    # Group by roadsegmentid (street level), not per bay
    segment_groups = {}
    for marker_id, status, lat, lon in sensor_rows:
        bay = bay_map.get(marker_id, {})
        seg_id = bay.get('street', f'{round(lat,3)},{round(lon,3)}')  # group by street name
        if seg_id not in segment_groups:
            segment_groups[seg_id] = {'total':0,'occupied':0,'bays':[]}
        segment_groups[seg_id]['total'] += 1
        if status.lower() in ('present','occupied'):
            segment_groups[seg_id]['occupied'] += 1
        segment_groups[seg_id]['bays'].append((marker_id, lat, lon))

    rows = []
    for seg_id, data in segment_groups.items():
        total = data['total']
        # Street-level occupancy — unique per street, not per bay
        occ_pct = round((data['occupied'] / total) * 100) if total > 0 else 50
        for marker_id, lat, lon in data['bays']:
            walk_m = haversine_m(lat, lon, MELBOURNE_CBD_LAT, MELBOURNE_CBD_LON)
            rows.append((marker_id, marker_id, occ_pct, walk_m, hour))

    if rows:
        con.executemany("""
            INSERT INTO bay_occupancy (bay_id, marker_id, occ_pct, walk_m, hour_of_day, updated_at)
            VALUES (?, ?, ?, ?, ?, current_timestamp)
            ON CONFLICT (bay_id) DO UPDATE SET
                occ_pct = excluded.occ_pct,
                walk_m = excluded.walk_m,
                hour_of_day = excluded.hour_of_day,
                updated_at = excluded.updated_at
        """, rows)
        print(f"✓ Built Silver layer — {len(rows)} bays with street-level occupancy %")