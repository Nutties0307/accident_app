import os
from pathlib import Path

import numpy as np
import pandas as pd

ROADS_FILE = Path(os.environ.get("SAFEROUTE_ROADS", "roads.gpkg"))
MAX_DISTANCE_M = 100
ROAD_TYPES_DEFAULT = (
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "unclassified", "residential", "living_street",
    "motorway_link", "trunk_link", "primary_link", "secondary_link", "tertiary_link",
)
UTM = "EPSG:32647"   # หน่วยเมตร (โซน 47N)
TILE_DEG = 0.5       # แบ่งงานเป็นช่องละ 0.5 องศา
MARGIN_DEG = 0.01    # ขอบเผื่อรอบช่อง (~1 กม.) กันถนนที่ข้ามขอบช่อง


class MapMatchingNotReady(Exception):
    pass


def match_points(df: pd.DataFrame, progress=lambda pct, msg="": None,
                 road_types=None, max_distance=MAX_DISTANCE_M) -> pd.DataFrame:
    """รับ df ที่มี latitude, longitude คืนเฉพาะแถวที่อยู่ห่างถนนไม่เกิน max_distance เมตร (พิกัดเดิม)"""
    if not ROADS_FILE.exists():
        raise MapMatchingNotReady(
            f"ไม่พบไฟล์ถนน {ROADS_FILE} กรุณาให้ผู้พัฒนารัน build_roads.py ก่อน")
    try:
        import geopandas as gpd
    except ImportError:
        raise MapMatchingNotReady("ยังไม่ได้ติดตั้ง geopandas (pip install geopandas pyogrio)")

    types = tuple(road_types or ROAD_TYPES_DEFAULT)
    d = df.reset_index(drop=True)
    pts = gpd.GeoDataFrame(
        d[["latitude", "longitude"]],
        geometry=gpd.points_from_xy(d["longitude"], d["latitude"]),
        crs="EPSG:4326",
    )

    tile = (np.floor(d["longitude"] / TILE_DEG).astype(int).astype(str) + "_"
            + np.floor(d["latitude"] / TILE_DEG).astype(int).astype(str))
    groups = list(pd.Series(np.arange(len(d))).groupby(tile.values))

    keep = np.zeros(len(d), dtype=bool)
    for i, (_, idx) in enumerate(groups):
        idx = idx.values
        sub = d.iloc[idx]
        bbox = (sub["longitude"].min() - MARGIN_DEG, sub["latitude"].min() - MARGIN_DEG,
                sub["longitude"].max() + MARGIN_DEG, sub["latitude"].max() + MARGIN_DEG)

        roads = gpd.read_file(ROADS_FILE, layer="roads", bbox=bbox)
        roads = roads[roads["highway"].isin(types)]

        if not roads.empty:
            roads_p = roads[["geometry"]].to_crs(UTM)
            pts_p = pts.iloc[idx][["geometry"]].to_crs(UTM)
            joined = gpd.sjoin_nearest(pts_p, roads_p, how="inner", max_distance=max_distance)
            keep[joined.index.unique().values] = True

        progress(int((i + 1) / len(groups) * 100), f"จับคู่ถนนแล้ว {i + 1}/{len(groups)} พื้นที่")

    return d[keep].reset_index(drop=True)