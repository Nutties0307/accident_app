import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/* =====================================================
   ข้อมูลที่ผู้ใช้ควรรู้: ช่วงเวลา/สภาพอากาศที่เกิดอุบัติเหตุบ่อยบนเส้นทาง
   (ข้อมูลมาจาก summary.time_weather ของ /api/route-risk)
===================================================== */

export type TimeWeather = {
  years: number[] | null; // ค.ศ. [เริ่ม, สิ้นสุด]
  hour_events: number;
  weather_events: number;
  by_hour: number[]; // 24 ช่อง
  weather: { weather: string; count: number; percent: number }[];
  day_percent?: number;
  night_percent?: number;
  peak_start_hour?: number;
  peak_percent?: number;
};

export type CurrentWeather = { category: 'rain' | 'fog' | 'clear'; label: string };

/** ดึงสภาพอากาศปัจจุบันจาก backend (ล้มเหลวได้ -> null แล้วซ่อนส่วนเทียบสภาพอากาศ) */
export function useCurrentWeather(
  apiUrl: string,
  lat: number | null | undefined,
  lng: number | null | undefined
): CurrentWeather | null {
  const [w, setW] = useState<CurrentWeather | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) {
      setW(null);
      return;
    }
    let cancelled = false;
    fetch(`${apiUrl}/api/weather-now?lat=${lat}&lng=${lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.category) setW(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiUrl, lat, lng]);

  return w;
}

const CATEGORY_REGEX = { rain: /ฝน/, fog: /หมอก/ } as const;

/** เทียบสภาพอากาศตอนนี้กับสภาพอากาศที่เกิดอุบัติเหตุบนเส้นทาง */
function weatherAssessment(tw: TimeWeather, cur: CurrentWeather | null | undefined) {
  if (!cur || tw.weather_events <= 0) return null;

  if (cur.category === 'clear') {
    const rainOrFog = tw.weather.filter((w) => /ฝน|หมอก/.test(w.weather));
    const pct = rainOrFog.reduce((a, b) => a + b.percent, 0);
    return {
      level: 'low' as const,
      label: `อากาศตอนนี้: ${cur.label}`,
      detail: `เหตุบนเส้นทางนี้เกิดตอนฝนตกหรือมีหมอก ${pct.toFixed(0)}%`,
    };
  }

  const hit = tw.weather.find((w) => CATEGORY_REGEX[cur.category].test(w.weather));
  const pct = hit ? hit.percent : 0;
  const warn =
    cur.category === 'rain' ? 'ถนนลื่น ควรชะลอความเร็ว' : 'มองเห็นได้ไม่ไกล ควรชะลอความเร็ว';

  return {
    level: pct >= 10 ? ('high' as const) : ('mid' as const),
    label: `อากาศตอนนี้: ${cur.label} ${warn}`,
    detail:
      pct > 0
        ? `เคยเกิดเหตุตอน${hit!.weather} ${pct.toFixed(0)}% ของเหตุบนเส้นทางนี้`
        : `ไม่พบสถิติเหตุตอน${cur.label}บนเส้นทางนี้`,
  };
}

const pad = (h: number) => String(h % 24).padStart(2, '0');

const range3 = (start: number) => `${pad(start)}:00–${pad(start + 2)}:59 น.`;

function nowAssessment(tw: TimeWeather) {
  const total = tw.hour_events;
  if (!total || tw.peak_start_hour === undefined) return null;

  const now = new Date();
  const h = now.getHours();
  const hh = `${pad(h)}:${String(now.getMinutes()).padStart(2, '0')}`;

  const inPeak = [0, 1, 2].some(
    (k) => (tw.peak_start_hour! + k) % 24 === h
  );
  const share = (tw.by_hour[h] / total) * 100;
  const avg = 100 / 24;
  const detail = `ช่วงที่เกิดบ่อยที่สุดของเส้นทางนี้: ${range3(tw.peak_start_hour)}`;

  if (inPeak) {
    return {
      level: 'high' as const,
      label: `ตอนนี้ ${hh} น. เป็นช่วงที่เกิดอุบัติเหตุบ่อยที่สุด`,
      detail: 'ขับระวังเป็นพิเศษ · ' + detail,
    };
  }
  if (share >= avg * 1.2) {
    return {
      level: 'mid' as const,
      label: `ตอนนี้ ${hh} น. เป็นช่วงที่เกิดอุบัติเหตุค่อนข้างบ่อย`,
      detail,
    };
  }
  return {
    level: 'low' as const,
    label: `ตอนนี้ ${hh} น. เป็นช่วงที่เกิดอุบัติเหตุไม่บ่อย`,
    detail,
  };
}

const COLORS = {
  high: { bg: '#FFF3E0', fg: '#BF360C', icon: '#E65100' },
  mid: { bg: '#FFF8E1', fg: '#8D6E00', icon: '#F9A825' },
  low: { bg: '#E8F5E9', fg: '#1B5E20', icon: '#2E7D32' },
};

/** สรุปสั้นๆ ใช้ในการ์ดความเสี่ยงหน้าแผนที่ (บรรทัดละเรื่อง มีไอคอน) */
export function TimeWeatherBrief({
  tw,
  current,
}: {
  tw: TimeWeather | null | undefined;
  current?: CurrentWeather | null;
}) {
  if (!tw) return null;
  const now = nowAssessment(tw);
  const wx = weatherAssessment(tw, current);

  const row = (
    key: string,
    icon: any,
    item: { level: 'high' | 'mid' | 'low'; label: string; detail: string }
  ) => (
    <View key={key} style={briefStyles.row}>
      <Ionicons name={icon} size={18} color={COLORS[item.level].icon} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[briefStyles.label, { color: COLORS[item.level].fg }]}>{item.label}</Text>
        <Text style={briefStyles.detail}>{item.detail}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ marginTop: 8 }}>
      {now ? row('now', 'time-outline', now) : null}
      {wx ? row('wx', wx.level === 'low' ? 'partly-sunny-outline' : 'rainy-outline', wx) : null}
      {tw.day_percent !== undefined ? (
        <Text style={briefStyles.small}>
          อุบัติเหตุตลอดวันบนเส้นทางนี้: กลางวัน {Math.round(tw.day_percent)}% · กลางคืน {Math.round(tw.night_percent ?? 0)}%
        </Text>
      ) : null}
    </View>
  );
}

const briefStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  detail: { fontSize: 12, color: '#6B7C79', marginTop: 1, lineHeight: 17 },
  small: { fontSize: 12, color: '#6B7C79', marginTop: 10 },
});

export default function TimeWeatherInfo({
  tw,
  current,
}: {
  tw: TimeWeather | null | undefined;
  current?: CurrentWeather | null;
}) {
  if (!tw) return null;

  const now = nowAssessment(tw);
  const wx = weatherAssessment(tw, current);
  const hasHour = tw.hour_events > 0 && tw.day_percent !== undefined;
  const maxHour = Math.max(1, ...tw.by_hour);
  const yearsText =
    tw.years && tw.years.length === 2
      ? ` พ.ศ. ${tw.years[0] + 543}–${tw.years[1] + 543}`
      : '';

  const night = tw.night_percent ?? 0;
  const rainy = tw.weather.find((w) => /ฝน/.test(w.weather));

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>ข้อมูลที่ควรรู้ก่อนเดินทาง</Text>

      {now ? (
        <View style={[styles.now, { backgroundColor: COLORS[now.level].bg }]}>
          <Ionicons
            name={now.level === 'low' ? 'time-outline' : 'time'}
            size={18}
            color={COLORS[now.level].icon}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.nowText, { color: COLORS[now.level].fg }]}>{now.label}</Text>
            <Text style={styles.nowDetail}>{now.detail}</Text>
          </View>
        </View>
      ) : null}

      {hasHour ? (
        <>
          <Text style={styles.sub}>ช่วงเวลาที่เกิดอุบัติเหตุ</Text>
          <View style={styles.split}>
            <View style={{ flex: Math.max(tw.day_percent!, 1), backgroundColor: '#F9A825' }} />
            <View style={{ flex: Math.max(night, 1), backgroundColor: '#37474F' }} />
          </View>
          <Text style={styles.line}>
            กลางวัน (06:00–17:59) {tw.day_percent}% · กลางคืน (18:00–05:59) {night}%
          </Text>

          <View style={styles.hours}>
            {tw.by_hour.map((n, h) => (
              <View key={h} style={styles.hourCol}>
                <View
                  style={[
                    styles.hourBar,
                    {
                      height: 4 + (n / maxHour) * 34,
                      backgroundColor: h >= 6 && h < 18 ? '#F9A825' : '#546E7A',
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.hourAxis}>
            {['00', '06', '12', '18', '23'].map((t) => (
              <Text key={t} style={styles.axisText}>{t}</Text>
            ))}
          </View>

          {tw.peak_start_hour !== undefined ? (
            <Text style={styles.line}>
              ช่วงที่เกิดบ่อยที่สุด: {range3(tw.peak_start_hour)} ({tw.peak_percent}% ของทั้งหมด)
            </Text>
          ) : null}
        </>
      ) : null}

      {tw.weather.length > 0 ? (
        <>
          <Text style={styles.sub}>สภาพอากาศตอนเกิดเหตุ</Text>
          {wx ? (
            <View style={[styles.now, { backgroundColor: COLORS[wx.level].bg, marginTop: 0, marginBottom: 8 }]}>
              <Ionicons
                name={wx.level === 'low' ? 'partly-sunny-outline' : 'rainy'}
                size={18}
                color={COLORS[wx.level].icon}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.nowText, { color: COLORS[wx.level].fg }]}>{wx.label}</Text>
                <Text style={styles.nowDetail}>{wx.detail}</Text>
              </View>
            </View>
          ) : null}
          {tw.weather.map((w) => (
            <View key={w.weather} style={styles.wRow}>
              <Text style={styles.wName}>{w.weather}</Text>
              <View style={styles.wTrack}>
                <View style={[styles.wFill, { width: `${Math.max(w.percent, 2)}%` }]} />
              </View>
              <Text style={styles.wPct}>{w.percent}%</Text>
            </View>
          ))}
        </>
      ) : null}

      {(night >= 50 || rainy) ? (
        <View style={styles.tips}>
          <Text style={styles.tipTitle}>คำแนะนำ</Text>
          {night >= 50 ? (
            <Text style={styles.tip}>• เหตุส่วนใหญ่เกิดตอนกลางคืน ควรเปิดไฟหน้า ลดความเร็ว และเว้นระยะห่างจากรถคันหน้า</Text>
          ) : null}
          {rainy ? (
            <Text style={styles.tip}>• เคยเกิดเหตุขณะฝนตก {rainy.percent}% ถนนลื่นและทัศนวิสัยต่ำ ควรชะลอความเร็วเมื่อฝนตก</Text>
          ) : null}
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 18 },
  heading: { fontSize: 14, fontWeight: '800', color: '#17403F' },
  now: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    marginTop: 10,
  },
  nowText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  nowDetail: { fontSize: 12, color: '#6B7C79', marginTop: 2, lineHeight: 17 },
  sub: { fontSize: 13, fontWeight: '800', color: '#17403F', marginTop: 16, marginBottom: 8 },
  split: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  line: { fontSize: 12, color: '#4F6F6B', marginTop: 8 },
  hours: { flexDirection: 'row', alignItems: 'flex-end', height: 40, marginTop: 12, gap: 2 },
  hourCol: { flex: 1, justifyContent: 'flex-end' },
  hourBar: { width: '100%', borderRadius: 2 },
  hourAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisText: { fontSize: 10, color: '#7A8F8B' },
  wRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  wName: { width: 84, fontSize: 12, color: '#17403F' },
  wTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E3F4EF', overflow: 'hidden' },
  wFill: { height: 8, borderRadius: 4, backgroundColor: '#1F8F7C' },
  wPct: { width: 44, fontSize: 12, color: '#4F6F6B', textAlign: 'right' },
  tips: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#EEF6F5' },
  tipTitle: { fontSize: 12, fontWeight: '800', color: '#0F5A62', marginBottom: 4 },
  tip: { fontSize: 12, color: '#17403F', lineHeight: 18 },
  note: { fontSize: 11, color: '#7A8F8B', marginTop: 12, lineHeight: 16 },
});