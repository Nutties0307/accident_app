from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
import base64
import json
import math
import os
import random
import string
import uuid

import bcrypt
import database
import httpx
import numpy as np

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.orm import Session

import admin
from auth import create_token, seed_first_admin


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")




app = FastAPI(
    title="SafeRoute API",
    description="API สำหรับระบบแจ้งเตือนความเสี่ยงอุบัติเหตุบนเส้นทาง",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)

SAVED_MAPS_DIR = BASE_DIR / "saved_maps"
SAVED_MAPS_DIR.mkdir(exist_ok=True)


app.mount(
    "/saved-maps-files",
    StaticFiles(directory=str(SAVED_MAPS_DIR)),
    name="saved-maps-files",
)

MAX_IMAGE_BASE64_LENGTH = 12_000_000




GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

if not GOOGLE_MAPS_API_KEY:
    print("WARNING: GOOGLE_MAPS_API_KEY ยังไม่ได้ตั้งค่า")

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")

mail_config = ConnectionConfig(
    MAIL_USERNAME=MAIL_USERNAME,
    MAIL_PASSWORD=MAIL_PASSWORD,
    MAIL_FROM=MAIL_FROM,
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

RESET_CODE_EXPIRE_MINUTES = 5


RISK_COLORS = {
    "ต่ำ": "#4CAF50",
    "ปานกลาง": "#FFC107",
    "สูง": "#FF9800",
    "สูงมาก": "#C62828",
}
NO_DATA_COLOR = "#9CA3AF"
NO_DATA_LABEL = "ไม่มีข้อมูล"
LEVEL_ORDER = ["สูงมาก", "สูง", "ปานกลาง", "ต่ำ"]
MAX_MATCH_DISTANCE_DEG = 0.0015
MAX_TOP_RISK_POINTS = 5

def get_db():
    db = database.SessionLocal()

    try:
        yield db
    finally:
        db.close()

risk_points_coords: np.ndarray | None = None
risk_points_levels: list[str] = []
risk_points_causes: list[str] = []
risk_points_provinces: list[str] = []
risk_points_counts: list[int] = []
risk_points_latest_years: list[int] = []

TIME_GRID = 0.0005
cell_time_stats: dict[tuple[int, int], tuple[np.ndarray, Counter]] = {}
time_stats_years: tuple[int, int] | None = None


def build_time_weather_stats():
    global cell_time_stats, time_stats_years

    cell_time_stats = {}
    time_stats_years = None

    db = database.SessionLocal()

    try:
        rows = db.execute(
            text(
                "SELECT latitude, longitude, year, accident_hour, weather "
                "FROM accident_events "
                "WHERE accident_hour IS NOT NULL OR weather IS NOT NULL"
            )
        ).fetchall()
    except Exception as e:
        print("ข้ามสถิติช่วงเวลา/สภาพอากาศ:", e)
        return
    finally:
        db.close()

    for lat, lon, year, hour, weather in rows:
        key = (
            int(np.rint(lat / TIME_GRID)),
            int(np.rint(lon / TIME_GRID)),
        )

        entry = cell_time_stats.get(key)

        if entry is None:
            entry = (np.zeros(24, dtype=np.int64), Counter())
            cell_time_stats[key] = entry

        if hour is not None and 0 <= int(hour) < 24:
            entry[0][int(hour)] += 1

        if weather:
            entry[1][str(weather).strip()] += 1

    if rows:
        years = [int(r[2]) for r in rows]
        time_stats_years = (min(years), max(years))

    print(f"โหลดสถิติช่วงเวลา/สภาพอากาศ: {len(rows):,} เหตุการณ์ ใน {len(cell_time_stats):,} ช่อง")


def summarize_time_weather(idx_set: set[int]) -> dict | None:
    """รวมสถิติช่วงเวลา/สภาพอากาศ ของตำแหน่งเสี่ยงที่เส้นทางผ่าน (นับแต่ละช่องครั้งเดียว)"""
    if not cell_time_stats or not idx_set:
        return None

    by_hour = np.zeros(24, dtype=np.int64)
    weather = Counter()
    seen: set[tuple[int, int]] = set()

    for i in idx_set:
        key = (
            int(np.rint(risk_points_coords[i][0] / TIME_GRID)),
            int(np.rint(risk_points_coords[i][1] / TIME_GRID)),
        )

        if key in seen:
            continue

        seen.add(key)
        entry = cell_time_stats.get(key)

        if entry is None:
            continue

        by_hour += entry[0]
        weather.update(entry[1])

    hour_total = int(by_hour.sum())
    weather_total = int(sum(weather.values()))

    if hour_total == 0 and weather_total == 0:
        return None

    result: dict = {
        "years": list(time_stats_years) if time_stats_years else None,
        "hour_events": hour_total,
        "weather_events": weather_total,
        "by_hour": [int(x) for x in by_hour],
        "weather": [
            {
                "weather": w,
                "count": int(c),
                "percent": round(c / weather_total * 100, 1),
            }
            for w, c in weather.most_common(4)
        ],
    }

    if hour_total > 0:
        day = int(by_hour[6:18].sum())
        result["day_percent"] = round(day / hour_total * 100, 1)
        result["night_percent"] = round((hour_total - day) / hour_total * 100, 1)

        best_start = max(
            range(24),
            key=lambda h: int(by_hour[h] + by_hour[(h + 1) % 24] + by_hour[(h + 2) % 24]),
        )
        best_sum = int(
            by_hour[best_start]
            + by_hour[(best_start + 1) % 24]
            + by_hour[(best_start + 2) % 24]
        )
        result["peak_start_hour"] = int(best_start)
        result["peak_percent"] = round(best_sum / hour_total * 100, 1)

    return result

speed_cameras: list[dict] = []
speed_cameras_coords: np.ndarray = np.empty((0, 2))
SPEED_CAMERA_MAX_M = 50.0
MAX_SPEED_CAMERAS_SHOWN = 30


@app.on_event("startup")
def load_speed_cameras():
    global speed_cameras, speed_cameras_coords

    speed_cameras = []
    speed_cameras_coords = np.empty((0, 2))

    db = database.SessionLocal()

    try:
        rows = db.execute(
            text("SELECT latitude, longitude, name, speed_limit FROM speed_cameras")
        ).fetchall()
    except Exception:
        return
    finally:
        db.close()

    speed_cameras = [
        {"latitude": r[0], "longitude": r[1], "name": r[2], "speed_limit": r[3]}
        for r in rows
    ]
    speed_cameras_coords = np.array([[r[0], r[1]] for r in rows], dtype=np.float64).reshape(-1, 2)

    print(f"โหลดกล้องตรวจจับความเร็ว: {len(speed_cameras):,} จุด")


def cameras_along_route(points) -> list[dict]:
    """กล้องที่อยู่ห่างเส้นทางไม่เกิน SPEED_CAMERA_MAX_M เมตร เรียงตามลำดับที่เส้นทางผ่าน"""
    if len(speed_cameras) == 0 or len(points) < 2:
        return []

    route = np.array([[p.latitude, p.longitude] for p in points], dtype=np.float64)

    pad = 0.001
    lo = route.min(axis=0) - pad
    hi = route.max(axis=0) + pad
    inside = np.where(
        (speed_cameras_coords[:, 0] >= lo[0]) & (speed_cameras_coords[:, 0] <= hi[0])
        & (speed_cameras_coords[:, 1] >= lo[1]) & (speed_cameras_coords[:, 1] <= hi[1])
    )[0]

    if len(inside) == 0:
        return []

    lat0 = float(route[:, 0].mean())
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110540.0

    def to_m(a: np.ndarray) -> np.ndarray:
        return np.stack([a[:, 1] * kx, a[:, 0] * ky], axis=1)

    rm = to_m(route)
    cm = to_m(speed_cameras_coords[inside])

    a = rm[:-1]
    ab = rm[1:] - a
    seg_len2 = (ab ** 2).sum(axis=1)
    seg_len = np.sqrt(seg_len2)
    cum = np.concatenate([[0.0], np.cumsum(seg_len)])

    found = []

    for ci, c in zip(inside, cm):
        ap = c - a
        t = np.where(
            seg_len2 > 0,
            np.clip((ap * ab).sum(axis=1) / np.where(seg_len2 > 0, seg_len2, 1.0), 0.0, 1.0),
            0.0,
        )
        proj = a + ab * t[:, None]
        d = np.sqrt(((c - proj) ** 2).sum(axis=1))
        k = int(np.argmin(d))

        if d[k] <= SPEED_CAMERA_MAX_M:
            found.append((cum[k] + t[k] * seg_len[k], int(ci)))

    found.sort()

    result = []

    for n, (dist_m, ci) in enumerate(found[:MAX_SPEED_CAMERAS_SHOWN], start=1):
        cam = speed_cameras[ci]
        result.append(
            {
                "no": n,
                "latitude": cam["latitude"],
                "longitude": cam["longitude"],
                "name": cam["name"],
                "speed_limit": cam["speed_limit"],
                "km_from_start": round(float(dist_m) / 1000, 1),
            }
        )

    return result


@app.on_event("startup")
def load_risk_points_cache():
    global risk_points_coords, risk_points_levels, risk_points_causes
    global risk_points_provinces, risk_points_counts, risk_points_latest_years

    db = database.SessionLocal()

    try:
        rows = db.execute(
            text(
                "SELECT latitude, longitude, risk_level, top_cause, "
                "province, total_count, latest_year "
                "FROM risk_points"
            )
        ).fetchall()
    finally:
        db.close()

    if not rows:
        print("WARNING: ตาราง risk_points ว่างเปล่า - เส้นทางจะไม่มีสีความเสี่ยง")
        risk_points_coords = np.empty((0, 2))
        risk_points_levels = []
        risk_points_causes = []
        risk_points_provinces = []
        risk_points_counts = []
        risk_points_latest_years = []
        return

    risk_points_coords = np.array(
        [[r[0], r[1]] for r in rows],
        dtype=np.float64,
    )
    risk_points_levels = [r[2] for r in rows]
    risk_points_causes = [r[3] for r in rows]
    risk_points_provinces = [r[4] for r in rows]
    risk_points_counts = [int(r[5]) for r in rows]
    risk_points_latest_years = [int(r[6]) for r in rows]

    print(f"โหลด risk_points เข้า cache แล้ว: {len(risk_points_levels):,} ตำแหน่ง")

    build_time_weather_stats()


@app.on_event("startup")
def setup_admin():
    admin.on_risk_points_changed = load_risk_points_cache
    seed_first_admin()


def find_nearest_risk_idx(lat: float, lng: float) -> int | None:
    """หา index ของตำแหน่งความเสี่ยงที่ใกล้ที่สุดกับพิกัดที่กำหนด (แบบ brute-force เวกเตอร์)"""

    if risk_points_coords is None or len(risk_points_coords) == 0:
        return None

    diffs = risk_points_coords - np.array([lat, lng])
    dists = np.sqrt((diffs**2).sum(axis=1))

    nearest_idx = int(np.argmin(dists))
    nearest_dist = dists[nearest_idx]

    if nearest_dist > MAX_MATCH_DISTANCE_DEG:
        return None

    return nearest_idx


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """ระยะทางระหว่าง 2 พิกัด หน่วยเมตร"""

    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    )

    return 2 * r * math.asin(math.sqrt(a))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str


class RoutePointRequest(BaseModel):
    latitude: float
    longitude: float


class RouteRiskRequest(BaseModel):
    points: list[RoutePointRequest]


class SaveMapRequest(BaseModel):
    user_id: int
    title: str
    start_name: str | None = None
    start_lat: float | None = None
    start_lon: float | None = None
    end_name: str | None = None
    end_lat: float | None = None
    end_lon: float | None = None
    image_base64: str
    summary: dict | None = None


@app.get("/")
def root():
    return {
        "message": "SafeRoute API is running",
        "status": "ok",
    }


@app.post("/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):

    existing_user = (
        db.query(database.User)
        .filter(database.User.email == request.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="อีเมลนี้ถูกใช้งานแล้ว",
        )

  
    hashed_password = bcrypt.hashpw(
        request.password.encode("utf-8"),
        bcrypt.gensalt(),
    )

    new_user = database.User(
        name=request.name,
        email=request.email,
        hashed_password=hashed_password.decode("utf-8"),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "ลงทะเบียนสำเร็จ",
        "user_id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
    }

@app.post("/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
   
    user = (
        db.query(database.User)
        .filter(database.User.email == request.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ไม่พบอีเมลนี้ในระบบ",
        )

    password_correct = bcrypt.checkpw(
        request.password.encode("utf-8"),
        user.hashed_password.encode("utf-8"),
    )

    if not password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="รหัสผ่านไม่ถูกต้อง",
        )

    return {
        "message": "เข้าสู่ระบบสำเร็จ",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "token": create_token(user),
        "is_admin": bool(user.is_admin),
    }

@app.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
   
    user = (
        db.query(database.User)
        .filter(database.User.email == request.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบอีเมลนี้ในระบบ",
        )

    reset_code = "".join(
        random.choices(
            string.digits,
            k=6,
        )
    )


    user.reset_token = reset_code

    user.reset_token_expire = (
        datetime.utcnow()
        + timedelta(minutes=RESET_CODE_EXPIRE_MINUTES)
    )

    db.commit()

  
    message = MessageSchema(
        subject="รีเซ็ตรหัสผ่าน SafeRoute",
        recipients=[request.email],
        body=(
            "รหัสยืนยันสำหรับตั้งรหัสผ่านใหม่ของคุณคือ: "
            f"{reset_code}\n\n"
            f"รหัสนี้จะหมดอายุใน "
            f"{RESET_CODE_EXPIRE_MINUTES} นาที"
        ),
        subtype="plain",
    )

    try:
        fm = FastMail(mail_config)

        await fm.send_message(message)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ไม่สามารถส่งอีเมลได้: {str(e)}",
        )

    return {
        "message": "ส่งรหัสยืนยันไปยังอีเมลแล้ว",
    }



@app.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    
    user = (
        db.query(database.User)
        .filter(database.User.email == request.email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบอีเมลนี้ในระบบ",
        )

    
    if (
        not user.reset_token
        or user.reset_token != request.reset_code
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสยืนยันไม่ถูกต้อง",
        )


    if (
        not user.reset_token_expire
        or datetime.utcnow() > user.reset_token_expire
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่",
        )

  
    hashed_password = bcrypt.hashpw(
        request.new_password.encode("utf-8"),
        bcrypt.gensalt(),
    )

    user.hashed_password = hashed_password.decode("utf-8")


    user.reset_token = None
    user.reset_token_expire = None

    db.commit()

    return {
        "message": "เปลี่ยนรหัสผ่านสำเร็จ",
    }

@app.get("/api/places")
async def search_places(
    query: str = Query(
        ...,
        min_length=1,
        description="คำค้นหาสถานที่ เช่น มหาวิทยาลัยมหิดล ศาลายา",
    ),
):
    

    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY",
        )

    url = "https://places.googleapis.com/v1/places:searchText"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": (
            "places.id,"
            "places.displayName,"
            "places.formattedAddress,"
            "places.location"
        ),
    }

    payload = {
        "textQuery": query.strip(),
        "languageCode": "th",
        "regionCode": "TH",
        "maxResultCount": 8,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"เกิดข้อผิดพลาดในการเชื่อมต่อ Google Places: {str(e)}",
            )

        except httpx.HTTPStatusError as e:
            try:
                google_error = e.response.json()
                message = (
                    google_error.get("error", {}).get("message")
                    or str(e)
                )
            except Exception:
                message = str(e)

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Google Places API Error: {message}",
            )

    places = []

    for item in data.get("places", []):
        location = item.get("location") or {}
        lat = location.get("latitude")
        lng = location.get("longitude")

        if lat is None or lng is None:
            continue

        display_name = item.get("displayName") or {}

        places.append(
            {
                "id": item.get("id") or f"{lat},{lng}",
                "name": display_name.get("text", ""),
                "address": item.get("formattedAddress", ""),
                "lat": lat,
                "lng": lng,
            }
        )

    return {
        "status": "success",
        "places": places,
    }


@app.get("/api/directions")
async def get_directions(
    origin: str = Query(
        ...,
        description="จุดเริ่มต้น เช่น ชื่อสถานที่ หรือพิกัด lat,lng",
    ),
    destination: str = Query(
        ...,
        description="จุดหมายปลายทาง เช่น ชื่อสถานที่ หรือพิกัด lat,lng",
    ),
):
   

    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY",
        )

    url = "https://maps.googleapis.com/maps/api/directions/json"

    params = {
        "origin": origin,
        "destination": destination,

        "key": GOOGLE_MAPS_API_KEY,

        "language": "th",

        
        "alternatives": "true",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:

        try:
            response = await client.get(
                url,
                params=params,
            )

            response.raise_for_status()

            data = response.json()

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"เกิดข้อผิดพลาดในการเชื่อมต่อ Google Maps: {str(e)}",
            )

        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Google Maps API HTTP Error: {str(e)}",
            )

    if data.get("status") != "OK":

        error_message = data.get(
            "error_message",
            "ไม่ทราบสาเหตุ",
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "ไม่สามารถดึงข้อมูลเส้นทางจาก Google Maps ได้: "
                f"{data.get('status')} - {error_message}"
            ),
        )

    return {
        "status": "success",

        "routes": data.get(
            "routes",
            [],
        ),

        "geocoded_waypoints": data.get(
            "geocoded_waypoints",
            [],
        ),
    }



@app.get("/api/streetview")
async def get_streetview(
    lat: float = Query(...),
    lng: float = Query(...),
    w: int = Query(400),
    h: int = Query(220),
):
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY",
        )

    w = max(100, min(w, 640))
    h = max(100, min(h, 640))

    params = {
        "size": f"{w}x{h}",
        "location": f"{lat},{lng}",
        "radius": 100,
        "source": "outdoor",
        "return_error_code": "true",
        "key": GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.get(
                "https://maps.googleapis.com/maps/api/streetview",
                params=params,
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="เชื่อมต่อ Google Street View ไม่ได้",
            )

    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่มีภาพ Street View บริเวณนี้",
        )

    return Response(
        content=r.content,
        media_type=r.headers["content-type"],
        headers={"Cache-Control": "public, max-age=86400"},
    )



_weather_cache: dict[tuple[float, float], tuple[float, dict]] = {}


def classify_weather_code(code: int) -> tuple[str, str]:
    """WMO weather code -> (หมวด, คำอธิบายไทย) หมวด: rain / fog / clear"""
    if code in (95, 96, 99):
        return "rain", "ฝนฟ้าคะนอง"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "rain", "ฝนตก"
    if code in (45, 48):
        return "fog", "หมอก"
    if code in (1, 2, 3):
        return "clear", "มีเมฆ"
    return "clear", "ท้องฟ้าโปร่ง"


@app.get("/api/weather-now")
async def get_weather_now(lat: float = Query(...), lng: float = Query(...)):
    key = (round(lat, 1), round(lng, 1))
    cached = _weather_cache.get(key)

    if cached and datetime.utcnow().timestamp() - cached[0] < 600:
        return cached[1]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "current": "weather_code,precipitation",
                    "timezone": "Asia/Bangkok",
                },
            )
        r.raise_for_status()
        cur = r.json().get("current") or {}
        code = int(cur.get("weather_code"))
        precip = float(cur.get("precipitation") or 0)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ดึงสภาพอากาศปัจจุบันไม่ได้",
        )

    category, label = classify_weather_code(code)


    if category == "clear" and precip >= 0.2:
        category, label = "rain", "ฝนตก"

    data = {"category": category, "label": label}
    _weather_cache[key] = (datetime.utcnow().timestamp(), data)

    return data



@app.post("/api/route-risk")
def get_route_risk(request: RouteRiskRequest):
   

    if risk_points_coords is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ข้อมูลความเสี่ยงยังไม่พร้อมใช้งาน (โหลด cache ไม่สำเร็จ)",
        )

    points = request.points

  
    idxs = [
        find_nearest_risk_idx(p.latitude, p.longitude)
        for p in points
    ]

    levels = [
        risk_points_levels[i] if i is not None else None
        for i in idxs
    ]

    results = []

    for point, level in zip(points, levels):
        results.append(
            {
                "latitude": point.latitude,
                "longitude": point.longitude,
                "risk_level": level or NO_DATA_LABEL,
                "color": RISK_COLORS.get(level, NO_DATA_COLOR),
            }
        )


    meters_by_level: dict[str, float] = {}
    total_m = 0.0

    for i in range(len(points) - 1):
        d = haversine_m(
            points[i].latitude,
            points[i].longitude,
            points[i + 1].latitude,
            points[i + 1].longitude,
        )

        key = levels[i] or NO_DATA_LABEL
        meters_by_level[key] = meters_by_level.get(key, 0.0) + d
        total_m += d

    level_summary = []

    for key in LEVEL_ORDER + [NO_DATA_LABEL]:
        m = meters_by_level.get(key, 0.0)

        level_summary.append(
            {
                "level": key,
                "color": RISK_COLORS.get(key, NO_DATA_COLOR),
                "km": round(m / 1000, 2),
                "percent": round(m / total_m * 100) if total_m > 0 else 0,
            }
        )

    def unique_idx_with_levels(wanted: tuple[str, ...]) -> set[int]:
        return {
            i
            for i, lv in zip(idxs, levels)
            if i is not None and lv in wanted
        }

    high_idx = unique_idx_with_levels(("สูง", "สูงมาก"))
    cause_idx = high_idx or unique_idx_with_levels(("ปานกลาง",))

    cause_counter = Counter(risk_points_causes[i] for i in cause_idx)

    top_causes = [
        {"cause": cause, "count": count}
        for cause, count in cause_counter.most_common(3)
    ]


    first_pos: dict[int, int] = {}

    for pos, i in enumerate(idxs):
        if i is not None and i in high_idx and i not in first_pos:
            first_pos[i] = pos

    def severity_key(i: int):
        return (
            0 if risk_points_levels[i] == "สูงมาก" else 1,
            -risk_points_counts[i],
            first_pos[i],
        )

    chosen = sorted(first_pos.keys(), key=severity_key)[:MAX_TOP_RISK_POINTS]
    chosen.sort(key=lambda i: first_pos[i])

    top_risk_points = [
        {
            "no": n,
            "latitude": float(risk_points_coords[i][0]),
            "longitude": float(risk_points_coords[i][1]),
            "risk_level": risk_points_levels[i],
            "color": RISK_COLORS.get(risk_points_levels[i], NO_DATA_COLOR),
            "province": risk_points_provinces[i],
            "top_cause": risk_points_causes[i],
            "total_count": risk_points_counts[i],
            "latest_year": risk_points_latest_years[i],
        }
        for n, i in enumerate(chosen, start=1)
    ]

    return {
        "status": "success",
        "points": results,
        "summary": {
            "top_risk_points": top_risk_points,
            "total_km": round(total_m / 1000, 2),
            "levels": level_summary,
            "high_risk_points": len(high_idx),
            "top_causes": top_causes,
            "time_weather": summarize_time_weather(
                {i for i in idxs if i is not None}
            ),
            "speed_cameras": cameras_along_route(points),
        },
    }


def saved_map_to_dict(row) -> dict:
    try:
        summary = json.loads(row.summary_json) if row.summary_json else None
    except json.JSONDecodeError:
        summary = None

    return {
        "id": row.id,
        "title": row.title,
        "start_name": row.start_name,
        "end_name": row.end_name,
        "start_lat": row.start_lat,
        "start_lon": row.start_lon,
        "end_lat": row.end_lat,
        "end_lon": row.end_lon,
        "image_url": f"/saved-maps-files/{row.image_filename}",
        "summary": summary,
        "created_at": row.created_at.isoformat() + "Z"
        if row.created_at
        else None,
    }


@app.post("/api/saved-maps")
def create_saved_map(
    request: SaveMapRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(database.User)
        .filter(database.User.id == request.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบผู้ใช้",
        )

    raw = request.image_base64

    if len(raw) > MAX_IMAGE_BASE64_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="รูปมีขนาดใหญ่เกินไป",
        )

    if raw.startswith("data:"):
        raw = raw.split(",", 1)[-1]

    try:
        image_bytes = base64.b64decode(raw)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ข้อมูลรูปไม่ถูกต้อง",
        )
    
    if image_bytes[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    elif image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        ext = "png"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="รองรับเฉพาะรูป JPEG หรือ PNG",
        )

    filename = f"{uuid.uuid4().hex}.{ext}"
    (SAVED_MAPS_DIR / filename).write_bytes(image_bytes)

    row = database.SavedMap(
        user_id=request.user_id,
        title=request.title.strip()[:200] or "แผนที่เส้นทาง",
        start_name=request.start_name,
        start_lat=request.start_lat,
        start_lon=request.start_lon,
        end_name=request.end_name,
        end_lat=request.end_lat,
        end_lon=request.end_lon,
        image_filename=filename,
        summary_json=(
            json.dumps(request.summary, ensure_ascii=False)
            if request.summary is not None
            else None
        ),
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "message": "บันทึกแผนที่สำเร็จ",
        "map": saved_map_to_dict(row),
    }


@app.get("/api/saved-maps")
def list_saved_maps(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(database.SavedMap)
        .filter(database.SavedMap.user_id == user_id)
        .order_by(database.SavedMap.id.desc())
        .all()
    )

    return {
        "status": "success",
        "maps": [saved_map_to_dict(r) for r in rows],
    }


@app.delete("/api/saved-maps/{map_id}")
def delete_saved_map(
    map_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    row = (
        db.query(database.SavedMap)
        .filter(
            database.SavedMap.id == map_id,
            database.SavedMap.user_id == user_id,
        )
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ไม่พบแผนที่ที่บันทึกไว้",
        )

    image_path = SAVED_MAPS_DIR / Path(row.image_filename).name

    try:
        image_path.unlink(missing_ok=True)
    except OSError:
        pass

    db.delete(row)
    db.commit()

    return {
        "message": "ลบแผนที่ที่บันทึกไว้แล้ว",
    }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )