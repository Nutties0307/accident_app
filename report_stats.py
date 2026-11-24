import sqlite3, sys
db = sys.argv[1] if len(sys.argv) > 1 else "accident_app.db"
c = sqlite3.connect(db)
q = lambda s: c.execute(s).fetchall()
print("DB:", db)
print("events ทั้งหมด:", q("select count(*) from accident_events")[0][0])
print("events แยกปี:", q("select year,count(*) from accident_events group by year order by year"))
n = q("select count(*) from risk_points")[0][0]
print("ตำแหน่งทั้งหมด:", n)
print("ตำแหน่งที่เกิดครั้งเดียว:", q("select count(*) from risk_points where total_count=1")[0][0])
print("ตำแหน่งที่เกิดมากกว่า 1 ครั้ง:", q("select count(*) from risk_points where total_count>1")[0][0])
print("ตำแหน่งที่ยัง active:", q("select count(*) from risk_points where is_still_active=1")[0][0])
print("ตำแหน่งที่ไม่ active:", q("select count(*) from risk_points where is_still_active=0")[0][0])
print("ระดับ:", q("select risk_level,count(*) from risk_points group by risk_level"))
print("ระดับ (active):", q("select risk_level,count(*),min(total_count),max(total_count) from risk_points where is_still_active=1 group by risk_level"))
print("ต่ำ แยก:", q("select is_still_active,count(*) from risk_points where risk_level='ต่ำ' group by is_still_active"))
try: print("settings:", q("select * from app_settings"))
except Exception as e: print(e)