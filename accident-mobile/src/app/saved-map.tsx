import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import AppMapWeb from '../components/AppMap.web';
import AppMapNative from '../components/AppMap.native';
import type { SpeedCameraMarker } from '../components/AppMap.web';
import TimeWeatherInfo, { useCurrentWeather, type TimeWeather } from '../components/TimeWeatherInfo';
import type { HighRiskMarker } from '../utils/mapSnapshot';
import { getSession } from '../utils/session';



const API_URL = (() => {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (Platform.OS === 'web') return 'http://127.0.0.1:8000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8000`;
  return 'http://10.0.2.2:8000';
})();

type Coord = { latitude: number; longitude: number };

type SavedMapRow = {
  id: number;
  title: string;
  start_name: string | null;
  end_name: string | null;
  start_lat: number | null;
  start_lon: number | null;
  end_lat: number | null;
  end_lon: number | null;
  created_at: string;
};

type RiskPoint = {
  latitude: number;
  longitude: number;
  risk_level: string;
  color: string;
};

type Summary = {
  total_km: number;
  levels: { level: string; color: string; km: number; percent: number }[];
  high_risk_points: number;
  top_causes: { cause: string; count: number }[];
  time_weather?: TimeWeather | null;
  speed_cameras?: SpeedCameraMarker[];
  top_risk_points: {
    no: number;
    latitude: number;
    longitude: number;
    risk_level: string;
    color: string;
    province: string;
    top_cause: string;
    total_count: number;
    latest_year: number;
  }[];
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatThaiDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${hh}:${mm}`;
}

function decodePolyline(encoded: string): Coord[] {
  const out: Coord[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    out.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return out;
}

export default function SavedMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 900;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<SavedMapRow | null>(null);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [riskPoints, setRiskPoints] = useState<RiskPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [info, setInfo] = useState<{ duration: string; distance: string } | null>(null);

  const idNum = Number(Array.isArray(params.id) ? params.id[0] : params.id);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const session = await getSession();

        if (!session) {
          throw new Error('กรุณาเข้าสู่ระบบก่อนดูแผนที่ที่บันทึกไว้');
        }

        // 1) อ่านรายการที่บันทึกไว้
        const listRes = await fetch(
          `${API_URL}/api/saved-maps?user_id=${session.userId}`
        );
        const listData = await listRes.json();

        if (!listRes.ok) {
          throw new Error('โหลดข้อมูลที่บันทึกไว้ไม่สำเร็จ');
        }

        const found: SavedMapRow | undefined = (listData?.maps || []).find(
          (m: SavedMapRow) => m.id === idNum
        );

        if (!found) {
          throw new Error('ไม่พบแผนที่ที่บันทึกไว้นี้');
        }

        if (
          found.start_lat == null ||
          found.start_lon == null ||
          found.end_lat == null ||
          found.end_lon == null
        ) {
          throw new Error('แผนที่นี้ไม่มีพิกัดต้นทาง/ปลายทาง จึงสร้างเส้นทางใหม่ไม่ได้');
        }

        // 2) ขอเส้นทางใหม่จาก Google Directions
        const dirRes = await fetch(
          `${API_URL}/api/directions` +
            `?origin=${encodeURIComponent(`${found.start_lat},${found.start_lon}`)}` +
            `&destination=${encodeURIComponent(`${found.end_lat},${found.end_lon}`)}`
        );
        const dirData = await dirRes.json();

        if (!dirRes.ok || !dirData?.routes?.length) {
          throw new Error(
            typeof dirData?.detail === 'string'
              ? dirData.detail
              : 'ไม่พบเส้นทางระหว่างสถานที่ที่บันทึกไว้'
          );
        }

        const route = dirData.routes[0];
        const encoded = route?.overview_polyline?.points;

        if (!encoded) {
          throw new Error('ไม่พบข้อมูลเส้นทางจาก Google Directions');
        }

        const decoded = decodePolyline(encoded);
        const leg = route?.legs?.[0];

        // 3) หาความเสี่ยงตามเส้นทาง
        const riskRes = await fetch(`${API_URL}/api/route-risk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: decoded.map((c) => ({
              latitude: c.latitude,
              longitude: c.longitude,
            })),
          }),
        });
        const riskData = await riskRes.json();

        if (!riskRes.ok) {
          throw new Error(
            typeof riskData?.detail === 'string'
              ? riskData.detail
              : 'ไม่สามารถดึงข้อมูลความเสี่ยงของเส้นทางได้'
          );
        }

        if (cancelled) return;

        setRow(found);
        setCoords(decoded);
        setRiskPoints(Array.isArray(riskData?.points) ? riskData.points : []);
        setSummary(riskData?.summary ?? null);
        setInfo(
          leg?.duration?.text && leg?.distance?.text
            ? { duration: leg.duration.text, distance: leg.distance.text }
            : null
        );
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'เปิดแผนที่ไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [idNum]);

  const currentWeather = useCurrentWeather(API_URL, row?.start_lat, row?.start_lon);

  const markers = useMemo<HighRiskMarker[]>(
    () =>
      (summary?.top_risk_points ?? []).map((p) => ({
        no: p.no,
        latitude: p.latitude,
        longitude: p.longitude,
        color: p.color,
        detail: {
          level: p.risk_level,
          province: p.province,
          cause: p.top_cause,
          count: p.total_count,
          year: p.latest_year,
        },
      })),
    [summary]
  );

  const origin = row
    ? {
        id: 'saved-origin',
        name: row.start_name || 'ต้นทาง',
        address: '',
        lat: row.start_lat as number,
        lng: row.start_lon as number,
      }
    : null;

  const destination = row
    ? {
        id: 'saved-destination',
        name: row.end_name || 'ปลายทาง',
        address: '',
        lat: row.end_lat as number,
        lng: row.end_lon as number,
      }
    : null;

  const goBack = () => router.replace('/search');

  /* ---------- แผงข้อมูล ---------- */
  const panel = (
    <View style={[styles.panel, isWide && styles.panelWide]}>
      <TouchableOpacity style={styles.backRow} onPress={goBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={20} color="#1B7F79" />
        <Text style={styles.backText}>แผนที่ที่บันทึกไว้</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#1F8F7C" />
          <Text style={styles.stateText}>กำลังสร้างแผนที่จากข้อมูลล่าสุด...</Text>
        </View>
      ) : error || !row ? (
        <View style={styles.stateBox}>
          <Ionicons name="alert-circle-outline" size={40} color="#C62828" />
          <Text style={styles.stateText}>{error || 'เปิดแผนที่ไม่สำเร็จ'}</Text>
          {error && error.includes('เข้าสู่ระบบ') ? (
            <TouchableOpacity style={styles.mainButton} onPress={() => router.replace('/')}>
              <Text style={styles.mainButtonText}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.title} numberOfLines={2}>
            {row.title}
          </Text>
          <Text style={styles.route}>
            {row.start_name || 'ต้นทาง'} → {row.end_name || 'ปลายทาง'}
          </Text>

          <View style={styles.chipRow}>
            {info ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {info.duration} · {info.distance}
                </Text>
              </View>
            ) : summary ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{summary.total_km.toFixed(1)} กม.</Text>
              </View>
            ) : null}
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                บันทึกเมื่อ {formatThaiDateTime(row.created_at)}
              </Text>
            </View>
          </View>

          {summary ? (
            <>
              <View
                style={[
                  styles.alertBox,
                  summary.high_risk_points > 0 ? styles.alertDanger : styles.alertOk,
                ]}
              >
                <Ionicons
                  name={summary.high_risk_points > 0 ? 'warning' : 'checkmark-circle'}
                  size={20}
                  color={summary.high_risk_points > 0 ? '#E65100' : '#2E7D32'}
                />
                <Text
                  style={[
                    styles.alertText,
                    { color: summary.high_risk_points > 0 ? '#BF360C' : '#1B5E20' },
                  ]}
                >
                  {summary.high_risk_points > 0
                    ? `เส้นทางนี้ผ่านจุดเสี่ยงสูง ${summary.high_risk_points} จุด`
                    : 'ไม่พบจุดเสี่ยงสูงบนเส้นทางนี้'}
                </Text>
              </View>

              {/* แถบสัดส่วนความเสี่ยงตามระยะทาง */}
              <Text style={styles.sectionTitle}>สัดส่วนความเสี่ยงตามระยะทาง</Text>
              <View style={styles.bar}>
                {summary.levels
                  .filter((l) => l.km > 0)
                  .map((l) => (
                    <View
                      key={l.level}
                      style={{ flex: l.km, backgroundColor: l.color }}
                    />
                  ))}
              </View>
              <View style={styles.legend}>
                {summary.levels
                  .filter((l) => l.km > 0)
                  .map((l) => (
                    <View key={l.level} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                      <Text style={styles.legendText}>
                        {l.level} {l.percent < 1 ? '<1' : l.percent}%
                      </Text>
                    </View>
                  ))}
              </View>

              {summary.top_risk_points.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>
                    {summary.high_risk_points > summary.top_risk_points.length
                      ? `จุดเสี่ยง ${summary.top_risk_points.length} จุดที่รุนแรงที่สุด (เรียงตามลำดับที่เส้นทางผ่าน)`
                      : 'จุดเสี่ยงบนเส้นทาง (เรียงตามลำดับที่เส้นทางผ่าน)'}
                  </Text>
                  {summary.top_risk_points.map((p) => (
                    <View key={p.no} style={styles.pointRow}>
                      <View style={[styles.pointNo, { backgroundColor: p.color }]}>
                        <Text style={styles.pointNoText}>{p.no}</Text>
                      </View>
                      <Text style={styles.pointText}>
                        {p.risk_level} · {(p.province || '').replace(/^จังหวัด/, '')} ·{' '}
                        {p.top_cause} · {p.total_count} ครั้ง
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}

              {summary.top_causes.length > 0 ? (
                <Text style={styles.line}>
                  สาเหตุหลัก: {summary.top_causes.map((c) => c.cause).join(', ')}
                </Text>
              ) : null}

              {summary.speed_cameras && summary.speed_cameras.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>
                    กล้องตรวจจับความเร็วบนเส้นทาง ({summary.speed_cameras.length} จุด)
                  </Text>
                  {summary.speed_cameras.map((c) => (
                    <View key={c.no} style={styles.pointRow}>
                      <View style={[styles.pointNo, { backgroundColor: '#6A1B9A' }]}>
                        <Text style={styles.pointNoText}>{c.no}</Text>
                      </View>
                      <Text style={styles.pointText}>
                        {/red\s*light/i.test(c.name || '')
                          ? 'กล้องจับฝ่าไฟแดง'
                          : /traffic\s*camera/i.test(c.name || '')
                          ? 'กล้องจราจร'
                          : 'กล้องตรวจจับความเร็ว'}
                        {' · '}
                        {/red\s*light/i.test(c.name || '')
                          ? 'ต้องหยุดเมื่อไฟแดง'
                          : c.speed_limit
                          ? `ต้องขับไม่เกิน ${c.speed_limit} กม./ชม.`
                          : 'ไม่มีข้อมูลความเร็วจำกัด ดูป้ายริมทาง'}
                        {' · ห่างจากต้นทาง ~'}{c.km_from_start} กม.
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.note}>
                    ตำแหน่งกล้องจาก OpenStreetMap และข้อมูลที่เพิ่มเอง อาจไม่ครบทุกจุด
                  </Text>
                </>
              ) : null}

              <TimeWeatherInfo tw={summary.time_weather} current={currentWeather} />

            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );

  /* ---------- แผนที่ ---------- */
  const mapView = (
    <View style={styles.mapBox}>
      {Platform.OS === 'web' ? (
        <AppMapWeb
          routeCoordinates={coords}
          routeRiskPoints={riskPoints}
          highRiskMarkers={markers}
          speedCameras={summary?.speed_cameras}
          originLocation={origin}
          destinationLocation={destination}
        />
      ) : (
        <AppMapNative
          routeCoordinates={coords}
          routeRiskPoints={riskPoints}
          highRiskMarkers={markers}
          originLocation={origin}
          destinationLocation={destination}
        />
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {mapView}
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EAF7F3' },

  mapBox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '55%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -6px 24px rgba(15,90,98,0.18)' } as any)
      : { elevation: 10 }),
  },

  panelWide: {
    left: 24,
    right: 'auto' as any,
    top: 24,
    bottom: 24,
    width: 400,
    maxHeight: undefined,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.88)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 10px 30px rgba(15,90,98,0.22)',
        } as any)
      : {}),
  },

  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backText: { color: '#1B7F79', fontWeight: '700', fontSize: 14, marginLeft: 2 },

  stateBox: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  stateText: { color: '#4F6F6B', fontSize: 14, textAlign: 'center' },

  mainButton: {
    marginTop: 6,
    backgroundColor: '#1F8F7C',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  mainButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  title: { fontSize: 20, fontWeight: '800', color: '#17403F' },
  route: { fontSize: 13, color: '#4F6F6B', marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: '#E3F4EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  chipText: { color: '#0F5A62', fontSize: 12, fontWeight: '600' },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
  },
  alertDanger: { backgroundColor: '#FFF3E0' },
  alertOk: { backgroundColor: '#E8F5E9' },
  alertText: { fontSize: 14, fontWeight: '700', flex: 1 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#17403F',
    marginTop: 18,
    marginBottom: 8,
  },

  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#4F6F6B' },

  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  pointNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointNoText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pointText: { flex: 1, fontSize: 13, color: '#17403F' },

  line: { fontSize: 13, color: '#17403F', marginTop: 10 },
  note: { fontSize: 11, color: '#7A8F8B', marginTop: 14 },
});