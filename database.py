from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import datetime

DATABASE_URL = "sqlite:///./accident_app.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    reset_token = Column(String, nullable=True)
    reset_token_expire = Column(DateTime, nullable=True)
   
    is_admin = Column(Boolean, nullable=False, default=False, server_default="0")

    search_history = relationship("SearchHistory", back_populates="user")
    saved_maps = relationship("SavedMap", back_populates="user")


class RiskPoint(Base):
    __tablename__ = "risk_points"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    province = Column(String, index=True, nullable=False)
    total_count = Column(Integer, nullable=False)
    n_distinct_years = Column(Integer, nullable=False)
    weighted_score = Column(Float, nullable=False)
    is_still_active = Column(Boolean, nullable=False)
    risk_score = Column(Float, index=True, nullable=False)
    risk_level = Column(String, index=True, nullable=False)
    top_cause = Column(String, nullable=False)
    latest_year = Column(Integer, nullable=False)


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    search_type = Column(String, nullable=False)
    start_location = Column(String, nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lon = Column(Float, nullable=True)
    end_location = Column(String, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lon = Column(Float, nullable=True)
    area_name = Column(String, nullable=True)
    searched_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="search_history")


class SavedMap(Base):


    __tablename__ = "saved_maps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    start_name = Column(String, nullable=True)
    start_lat = Column(Float, nullable=True)
    start_lon = Column(Float, nullable=True)
    end_name = Column(String, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lon = Column(Float, nullable=True)
    image_filename = Column(String, nullable=False)
    summary_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="saved_maps")




class DataVersion(Base):
    """ประวัติการอัปเดตข้อมูล 1 แถว = 1 ครั้งที่แอดมินทำ (นำเข้าครั้งแรก / อัปโหลดไฟล์ / เปลี่ยนช่วงปี / ย้อนกลับ)"""

    __tablename__ = "data_versions"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    message = Column(String, nullable=True)
    rows_in_file = Column(Integer, nullable=True)
    rows_added = Column(Integer, nullable=True)
    year_min = Column(Integer, nullable=True)
    year_max = Column(Integer, nullable=True)
    active_years = Column(String, nullable=True)
    is_rolled_back = Column(Boolean, nullable=False, default=False, server_default="0")
    summary_json = Column(Text, nullable=True)


class AccidentEvent(Base):
    """อุบัติเหตุรายเหตุการณ์ที่ผ่านการจับคู่ถนนแล้ว (ใช้คำนวณ risk_points ใหม่ได้โดยไม่ต้องทำ Map Matching ซ้ำ)"""

    __tablename__ = "accident_events"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    province = Column(String, nullable=True)
    year = Column(Integer, nullable=False, index=True)
    cause = Column(String, nullable=True)
    version_id = Column(Integer, ForeignKey("data_versions.id"), nullable=True, index=True)
   
    accident_hour = Column(Integer, nullable=True)
    weather = Column(String, nullable=True)


class SpeedCamera(Base):
    """ตำแหน่งกล้องตรวจจับความเร็ว (จาก OpenStreetMap และ/หรือไฟล์ CSV ที่เพิ่มเอง)"""

    __tablename__ = "speed_cameras"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    name = Column(String, nullable=True)
    speed_limit = Column(Integer, nullable=True)
    source = Column(String, nullable=False, default="osm")


class AppSetting(Base):
    """ค่าตั้งค่าของระบบ เช่น active_years"""

    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)


Base.metadata.create_all(bind=engine)


def _migrate():
    """create_all ไม่เพิ่มคอลัมน์ให้ตารางที่มีอยู่แล้ว จึงเพิ่ม users.is_admin เองถ้ายังไม่มี"""
    with engine.begin() as conn:
        cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()]
        if "is_admin" not in cols:
            conn.exec_driver_sql(
                "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"
            )

        ev_cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(accident_events)").fetchall()]
        if ev_cols and "accident_hour" not in ev_cols:
            conn.exec_driver_sql("ALTER TABLE accident_events ADD COLUMN accident_hour INTEGER")
        if ev_cols and "weather" not in ev_cols:
            conn.exec_driver_sql("ALTER TABLE accident_events ADD COLUMN weather TEXT")


_migrate()