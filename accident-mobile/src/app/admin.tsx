import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';
import { clearSession, getSession } from '../utils/session';
import AuthBackground from '../components/AuthBackground';

/* =====================================================
   หน้าผู้ดูแลระบบ (ใช้บนเว็บเท่านั้น)
   ===================================================== */

const API_URL = 'http://127.0.0.1:8000';

const LEVELS: { name: string; color: string }[] = [
  { name: 'สูงมาก', color: '#C62828' },
  { name: 'สูง', color: '#FF9800' },
  { name: 'ปานกลาง', color: '#FFC107' },
  { name: 'ต่ำ', color: '#4CAF50' },
];

const KIND_LABEL: Record<string, string> = {
  initial: 'นำเข้าข้อมูลเดิม',
  upload: 'อัปโหลดไฟล์',
  recompute: 'เปลี่ยนช่วงปี',
  rollback: 'นำข้อมูลออก',
};

const STATUS_LABEL: Record<string, string> = {
  queued: 'รอคิว',
  running: 'กำลังประมวลผล',
  done: 'สำเร็จ',
  failed: 'ล้มเหลว',
};

type Overview = {
  events_by_year: Record<string, number>;
  total_events: number;
  risk_points: number;
  levels: Record<string, number>;
  active_years: number[];
  last_update: string | null;
};

type VersionRow = {
  id: number;
  kind: string;
  filename: string | null;
  status: string;
  progress: number;
  message: string | null;
  rows_added: number | null;
  active_years: string | null;
  is_rolled_back: boolean;
  created_at: string | null;
};

type Job = {
  id: number;
  status: string;
  progress: number;
  message: string | null;
  summary: { levels?: Record<string, number> } | null;
};

type Preview = {
  upload_id: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  invalid_reasons: Record<string, number>;
  year_counts: Record<string, number>;
  sample: { year: number; province: string; cause: string; latitude: number; longitude: number }[];
  existing_years: Record<string, number>;
  overlap_years: number[];
  duplicate_rows?: number;
};

const fmt = (n: number | undefined | null) =>
  typeof n === 'number' ? n.toLocaleString('th-TH') : '-';

const fmtDate = (iso: string | null) => {
  if (!iso) return '-';
  // เซิร์ฟเวอร์เก็บเวลา UTC แบบไม่มี Z
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const toBE = (y: number) => y + 543;

export default function AdminScreen() {
  const router = useRouter();

  const tokenRef = useRef<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [jobWhere, setJobWhere] = useState<'years' | 'upload' | 'history' | 'manual'>('years');
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [replaceOld, setReplaceOld] = useState(false);
  const [appendOld, setAppendOld] = useState(false);

  /* ---------- เรียก API พร้อมแนบ token ---------- */

  const api = useCallback(
    async (path: string, options: { method?: string; body?: unknown } = {}) => {
      const res = await fetch(`${API_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (res.status === 401) {
        // token หมดอายุ -> ให้ล็อกอินใหม่
        await clearSession();
        router.replace('/');
        throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.detail || 'เกิดข้อผิดพลาด');
      }

      return data;
    },
    [router]
  );

  const load = useCallback(async () => {
    try {
      const [ov, vs] = await Promise.all([
        api('/api/admin/overview'),
        api('/api/admin/versions'),
      ]);
      setOverview(ov);
      setVersions(vs);
      // เลือกเฉพาะปีที่ยังมีข้อมูลอยู่จริง (กันกรณีปีที่ตั้งไว้ถูกถอดข้อมูลออกแล้ว)
      const avail = Object.keys(ov.events_by_year || {}).map(Number);
      setSelected((ov.active_years || []).filter((y: number) => avail.includes(y)));
      setError('');
    } catch (e: any) {
      setError(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
    }
  }, [api]);

  /* ---------- ตรวจสิทธิ์ตอนเปิดหน้า ---------- */

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        setReady(true);
        return;
      }

      const session = await getSession();

      if (!session?.token) {
        router.replace('/');
        return;
      }

      if (!session.isAdmin) {
        router.replace('/home');
        return;
      }

      tokenRef.current = session.token;
      setAdminName(session.name || session.email || '');
      setReady(true);
      load();
    })();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router, load]);

  /* ---------- เปลี่ยนช่วงปี + ติดตามความคืบหน้า ---------- */

  const removeUpload = async (id: number) => {
    setRemovingId(null);
    setError('');

    try {
      const res = await api(`/api/admin/versions/${id}/rollback`, { method: 'POST' });

      setJobWhere('history');
      setJob({
        id: res.version_id,
        status: 'queued',
        progress: 0,
        message: 'กำลังเริ่มนำข้อมูลออก',
        summary: null,
      });
      poll(res.version_id);
    } catch (e: any) {
      setError(e?.message || 'ไม่สามารถนำข้อมูลออกได้');
    }
  };

  const toggleYear = (y: number) => {
    setConfirming(false);
    setSelected((cur) =>
      cur.includes(y) ? cur.filter((v) => v !== y) : [...cur, y].sort((a, b) => a - b)
    );
  };

  const poll = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const v = await api(`/api/admin/versions/${id}`);
        setJob({ ...v });

        if (v.status === 'done' || v.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          load();
        }
      } catch (e: any) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setError(e?.message || 'ติดตามความคืบหน้าไม่สำเร็จ');
      }
    }, 1000);
  };

  const applyYears = async () => {
    setConfirming(false);
    setError('');
    setJobWhere('years');

    try {
      const res = await api('/api/admin/settings', {
        method: 'PUT',
        body: { active_years: selected },
      });

      setJob({
        id: res.version_id,
        status: 'queued',
        progress: 0,
        message: 'กำลังเริ่มประมวลผล',
        summary: null,
      });

      poll(res.version_id);
    } catch (e: any) {
      setError(e?.message || 'ไม่สามารถเริ่มประมวลผลได้');
    }
  };

  /* ---------- อัปโหลดไฟล์ข้อมูลใหม่ ---------- */

  const onPickFile = async (e: any) => {
    const f = e?.target?.files?.[0];
    if (!f) return;

    setUploading(true);
    setError('');
    setPreview(null);

    try {
      const form = new FormData();
      form.append('file', f);

      const res = await fetch(`${API_URL}/api/admin/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
        body: form,
      });

      if (res.status === 401) {
        await clearSession();
        router.replace('/');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'ตรวจไฟล์ไม่สำเร็จ');

      setPreview(data);
      setReplaceOld(false);
      setAppendOld(false);
    } catch (err: any) {
      setError(err?.message || 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmUpload = async () => {
    if (!preview) return;
    setError('');

    try {
      const res = await api('/api/admin/uploads/confirm', {
        method: 'POST',
        body: {
          upload_id: preview.upload_id,
          replace_existing: replaceOld,
          append_existing: appendOld,
        },
      });

      setJobWhere('upload');
      setJob({
        id: res.version_id,
        status: 'queued',
        progress: 0,
        message: 'กำลังเริ่มประมวลผล',
        summary: null,
      });
      setPreview(null);
      poll(res.version_id);
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถเริ่มนำเข้าได้');
    }
  };

  const logout = async () => {
    await clearSession();
    router.replace('/');
  };

  /* ---------- UI ---------- */

  if (Platform.OS !== 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.pageTitle}>หน้าผู้ดูแลระบบ</Text>
          <Text style={styles.muted}>ใช้งานได้เฉพาะบนเว็บเบราว์เซอร์</Text>
          <TouchableOpacity style={styles.ghostButton} onPress={() => router.replace('/home')}>
            <Text style={styles.ghostButtonText}>กลับหน้าหลัก</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!ready || !overview) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color="#1F8F7C" />}
        </View>
      </SafeAreaView>
    );
  }

  const years = Object.keys(overview.events_by_year)
    .map(Number)
    .sort((a, b) => a - b);

  const sameAsCurrent =
    selected.length === overview.active_years.length &&
    selected.every((y) => overview.active_years.includes(y));

  const busy = !!job && (job.status === 'queued' || job.status === 'running');
  const totalLevel = Object.values(overview.levels).reduce((a, b) => a + b, 0) || 1;

  const renderJob = () =>
    job ? (
              <View style={styles.progressBox}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${job.status === 'done' ? 100 : Math.max(job.progress, 3)}%`,
                        backgroundColor: job.status === 'failed' ? '#D64545' : '#1F8F7C',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {STATUS_LABEL[job.status] || job.status} · {job.progress}%
                  {job.message ? ` · ${job.message}` : ''}
                </Text>

                {job.status === 'done' && job.summary?.levels ? (
                  <Text style={styles.okText}>
                    เสร็จแล้ว: สูงมาก {fmt(job.summary.levels['สูงมาก'])} · สูง {fmt(job.summary.levels['สูง'])} ·
                    ปานกลาง {fmt(job.summary.levels['ปานกลาง'])} · ต่ำ {fmt(job.summary.levels['ต่ำ'])}
                  </Text>
                ) : null}
              </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <View
          style={[
            StyleSheet.absoluteFill,
            ({ filter: 'blur(14px)', transform: [{ scale: 1.08 }] } as any),
          ]}
        >
          <AuthBackground />
        </View>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(235,252,245,0.35)' }]} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.page}>
          {/* ---------- หัวหน้า ---------- */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>SAFEROUTE · ผู้ดูแลระบบ</Text>
              <Text style={styles.pageTitle}>จัดการข้อมูลอุบัติเหตุ</Text>
              {adminName ? <Text style={styles.muted}>เข้าสู่ระบบเป็น {adminName}</Text> : null}
            </View>

            <TouchableOpacity style={styles.ghostButton} onPress={() => router.push('/home')}>
              <Text style={styles.ghostButtonText}>ไปหน้าแอป</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.ghostButton, { marginLeft: 8 }]} onPress={logout}>
              <Text style={styles.ghostButtonText}>ออกจากระบบ</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ---------- ภาพรวม ---------- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ภาพรวมข้อมูลปัจจุบัน</Text>

            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{fmt(overview.total_events)}</Text>
                <Text style={styles.statLabel}>อุบัติเหตุทั้งหมด (ครั้ง)</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{fmt(overview.risk_points)}</Text>
                <Text style={styles.statLabel}>ตำแหน่งความเสี่ยง</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {overview.active_years.length
                    ? overview.active_years.map(toBE).join(', ')
                    : '-'}
                </Text>
                <Text style={styles.statLabel}>ปีที่ใช้คำนวณ (พ.ศ.)</Text>
              </View>
            </View>

            <Text style={styles.subTitle}>สัดส่วนตำแหน่งตามระดับความเสี่ยง</Text>

            <View style={styles.levelBar}>
              {LEVELS.map((lv) => {
                const n = overview.levels[lv.name] || 0;
                return n > 0 ? (
                  <View key={lv.name} style={{ flex: n / totalLevel, backgroundColor: lv.color }} />
                ) : null;
              })}
            </View>

            <View style={styles.legendRow}>
              {LEVELS.map((lv) => (
                <View key={lv.name} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: lv.color }]} />
                  <Text style={styles.legendText}>
                    {lv.name} {fmt(overview.levels[lv.name] || 0)}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.muted}>อัปเดตล่าสุด {fmtDate(overview.last_update)}</Text>
          </View>

          {/* ---------- นำเข้าข้อมูลปีใหม่ ---------- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>นำเข้าข้อมูลปีใหม่</Text>
            <Text style={styles.muted}>
              เลือกไฟล์ Excel (.xlsx) หรือ CSV ที่คลีนแล้ว โดยมีคอลัมน์เหมือนไฟล์ข้อมูลเดิม ระบบจะตรวจไฟล์และแสดงตัวอย่างให้ดูก่อนนำเข้า
            </Text>

            {React.createElement('input', {
              ref: fileRef,
              type: 'file',
              accept: '.xlsx,.csv',
              style: { display: 'none' },
              onChange: onPickFile,
            })}

            <TouchableOpacity
              style={[styles.mainButton, styles.mt12, (busy || uploading) && styles.disabled]}
              disabled={busy || uploading}
              onPress={() => fileRef.current?.click()}
            >
              <Text style={styles.mainButtonText}>{uploading ? 'กำลังตรวจไฟล์...' : 'เลือกไฟล์'}</Text>
            </TouchableOpacity>

            {preview ? (
              <View style={styles.previewBox}>
                <Text style={styles.historyTitle}>{preview.filename}</Text>
                <Text style={styles.muted}>
                  ทั้งหมด {fmt(preview.total_rows)} แถว · ใช้ได้ {fmt(preview.valid_rows)} · ข้าม {fmt(preview.invalid_rows)}
                </Text>

                {Object.entries(preview.invalid_reasons || {}).map(([k, v]) => (
                  <Text key={k} style={styles.errorText}>
                    • {k}: {fmt(v)} แถว
                  </Text>
                ))}

                <Text style={styles.subTitle}>จำนวนแถวแต่ละปี (พ.ศ.)</Text>
                <View style={styles.legendRow}>
                  {Object.entries(preview.year_counts).map(([y, n]) => (
                    <Text key={y} style={styles.legendText}>
                      {toBE(Number(y))}: {fmt(n)}
                      {preview.overlap_years.includes(Number(y)) ? ' (มีในระบบแล้ว)' : ''}
                      {'   '}
                    </Text>
                  ))}
                </View>

                <Text style={styles.subTitle}>ตัวอย่างข้อมูล</Text>
                {preview.sample.map((r, i) => (
                  <Text key={i} style={styles.sampleRow}>
                    {toBE(r.year)} · {r.province || '-'} · {r.cause || '-'} · {r.latitude}, {r.longitude}
                  </Text>
                ))}

                {preview.overlap_years.length > 0 ? (
                  <View style={styles.warnBox}>
                    <Text style={styles.confirmText}>
                      ในระบบมีข้อมูลปี {preview.overlap_years.map(toBE).join(', ')} อยู่แล้ว
                      กรุณาเลือกวิธีนำเข้า
                    </Text>
                    {(preview.duplicate_rows ?? 0) > 0 ? (
                      <Text style={[styles.confirmText, { color: '#C62828', marginTop: 8 }]}>
                        ⚠ พบ {fmt(preview.duplicate_rows)} จาก {fmt(preview.valid_rows)} แถวในไฟล์นี้ซ้ำกับข้อมูลเดิมในระบบ
                        หากเลือก "เพิ่มต่อ" ระบบจะข้ามแถวที่ซ้ำให้อัตโนมัติ (ไม่นับซ้ำ)
                      </Text>
                    ) : (
                      <Text style={[styles.confirmText, { color: '#2E7D32', marginTop: 8 }]}>
                        ไม่พบแถวที่ซ้ำกับข้อมูลเดิม
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.chip, appendOld && styles.chipOn, styles.mt12, { alignSelf: 'flex-start' }]}
                      onPress={() => {
                        setAppendOld((v) => !v);
                        setReplaceOld(false);
                      }}
                    >
                      <Text style={[styles.chipText, appendOld && styles.chipTextOn]}>
                        {appendOld ? '✓ เพิ่มต่อจากข้อมูลเดิม (ไม่ลบข้อมูลเดิม)' : 'เพิ่มต่อจากข้อมูลเดิม (ไม่ลบข้อมูลเดิม)'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chip, replaceOld && styles.chipOn, styles.mt12, { alignSelf: 'flex-start' }]}
                      onPress={() => {
                        setReplaceOld((v) => !v);
                        setAppendOld(false);
                      }}
                    >
                      <Text style={[styles.chipText, replaceOld && styles.chipTextOn]}>
                        {replaceOld ? '✓ แทนที่ข้อมูลของปีนั้นทั้งหมด (ข้อมูลเดิมของปีนั้นจะถูกลบ)' : 'แทนที่ข้อมูลของปีนั้นทั้งหมด (ข้อมูลเดิมของปีนั้นจะถูกลบ)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <Text style={styles.muted}>
                  ระบบจะจับคู่พิกัดกับถนนก่อนนำเข้า แถวที่อยู่ไกลถนนเกินเกณฑ์จะถูกตัดออกโดยอัตโนมัติ
                  หลังนำเข้าจะคำนวณความเสี่ยงใหม่ด้วยช่วงปีเดิม ({overview.active_years.map(toBE).join(', ')}) หากต้องการเปลี่ยนช่วงปี ให้ทำที่ส่วน "ช่วงปีที่ใช้คำนวณความเสี่ยง"
                </Text>

                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.mainButton,
                      preview.overlap_years.length > 0 && !replaceOld && !appendOld && styles.disabled,
                    ]}
                    disabled={preview.overlap_years.length > 0 && !replaceOld && !appendOld}
                    onPress={confirmUpload}
                  >
                    <Text style={styles.mainButtonText}>ยืนยันนำเข้าข้อมูล</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { marginLeft: 8 }]} onPress={() => setPreview(null)}>
                    <Text style={styles.ghostButtonText}>ยกเลิก</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {jobWhere === 'upload' ? renderJob() : null}
          </View>

          {/* ---------- เลือกช่วงปี ---------- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ช่วงปีที่ใช้คำนวณความเสี่ยง</Text>
            <Text style={styles.muted}>
              จุดที่มีอุบัติเหตุล่าสุดอยู่ในปีที่เลือกจะนับเป็นจุดเสี่ยงปัจจุบัน
            </Text>

            <View style={styles.chipRow}>
              {years.map((y) => {
                const on = selected.includes(y);
                return (
                  <TouchableOpacity
                    key={y}
                    disabled={busy}
                    onPress={() => toggleYear(y)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{toBE(y)}</Text>
                    <Text style={[styles.chipSub, on && styles.chipTextOn]}>
                      {fmt(overview.events_by_year[String(y)])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!confirming ? (
              <TouchableOpacity
                style={[styles.mainButton, (busy || sameAsCurrent || !selected.length) && styles.disabled]}
                disabled={busy || sameAsCurrent || !selected.length}
                onPress={() => setConfirming(true)}
              >
                <Text style={styles.mainButtonText}>คำนวณความเสี่ยงใหม่ด้วยช่วงปีนี้</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  ยืนยันใช้ปี {selected.map(toBE).join(', ')} ? ระดับความเสี่ยงที่ผู้ใช้เห็นจะเปลี่ยนทันทีเมื่อเสร็จ
                  (ย้อนกลับได้โดยเลือกช่วงปีเดิมแล้วคำนวณใหม่)
                </Text>
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <TouchableOpacity style={styles.mainButton} onPress={applyYears}>
                    <Text style={styles.mainButtonText}>ยืนยัน</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ghostButton, { marginLeft: 8 }]}
                    onPress={() => setConfirming(false)}
                  >
                    <Text style={styles.ghostButtonText}>ยกเลิก</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {jobWhere === 'years' ? renderJob() : null}
          </View>

          {/* ---------- ประวัติ ---------- */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ประวัติการอัปเดตข้อมูล</Text>

            {jobWhere === 'history' ? renderJob() : null}

            {versions.length === 0 ? <Text style={styles.muted}>ยังไม่มีประวัติ</Text> : null}

            {versions.map((v) => (
              <View key={v.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>
                    {KIND_LABEL[v.kind] || v.kind}
                    {v.filename ? ` · ${v.filename}` : ''}
                  </Text>
                  <Text style={styles.muted}>
                    {fmtDate(v.created_at)}
                    {v.active_years
                      ? ` · ปีที่ใช้ ${v.active_years.split(',').map((y) => toBE(Number(y))).join(', ')}`
                      : ''}
                    {typeof v.rows_added === 'number' ? ` · เพิ่ม ${fmt(v.rows_added)} แถว` : ''}
                  </Text>
                  {v.status === 'failed' && v.message ? (
                    <Text style={styles.errorText}>{v.message}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.badge,
                      v.status === 'done' && styles.badgeOk,
                      v.status === 'failed' && styles.badgeFail,
                    ]}
                  >
                    {v.is_rolled_back ? 'นำออกแล้ว' : STATUS_LABEL[v.status] || v.status}
                  </Text>

                  {v.kind === 'upload' && v.status === 'done' && !v.is_rolled_back && !busy ? (
                    removingId === v.id ? (
                      <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
                        <Text style={styles.confirmText}>นำข้อมูลของไฟล์นี้ออกจากระบบ?</Text>
                        <View style={{ flexDirection: 'row', marginTop: 6 }}>
                          <TouchableOpacity style={styles.dangerButton} onPress={() => removeUpload(v.id)}>
                            <Text style={styles.mainButtonText}>ยืนยันนำออก</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.ghostButton, { marginLeft: 6 }]}
                            onPress={() => setRemovingId(null)}
                          >
                            <Text style={styles.ghostButtonText}>ยกเลิก</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.ghostButton, { marginTop: 8 }]}
                        onPress={() => setRemovingId(v.id)}
                      >
                        <Text style={styles.ghostButtonText}>นำไฟล์นี้ออก</Text>
                      </TouchableOpacity>
                    )
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES
   ===================================================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#C8F0E0' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  page: { width: '100%', maxWidth: 880 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  brand: { fontSize: 11, fontWeight: '700', color: '#1B7F79', letterSpacing: 2, marginBottom: 4 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#0F5A62' },
  muted: { fontSize: 12, color: '#4F6F6B', marginTop: 4 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 12px 40px rgba(15,90,98,0.16)',
        } as any)
      : {}),
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0F5A62', marginBottom: 8 },
  subTitle: { fontSize: 13, fontWeight: '700', color: '#1B7F79', marginTop: 16, marginBottom: 8 },

  statRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  stat: { minWidth: 180, flex: 1, paddingVertical: 8, paddingRight: 12 },
  statValue: { fontSize: 26, fontWeight: '800', color: '#0F5A62' },
  statLabel: { fontSize: 12, color: '#4F6F6B', marginTop: 2 },

  levelBar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#D5ECE4' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: '#17403F' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 14 },
  chip: {
    borderWidth: 1.5,
    borderColor: '#BFE3D8',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  chipOn: { backgroundColor: '#1F8F7C', borderColor: '#1F8F7C' },
  chipText: { fontSize: 15, fontWeight: '800', color: '#17403F' },
  chipSub: { fontSize: 11, color: '#4F6F6B', marginTop: 2 },
  chipTextOn: { color: '#FFFFFF' },

  mainButton: {
    backgroundColor: '#1F8F7C',
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  mainButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },

  ghostButton: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#9FD3C5',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  ghostButtonText: { color: '#1B7F79', fontSize: 13, fontWeight: '700' },

  mt12: { marginTop: 12 },
  dangerButton: {
    backgroundColor: '#D64545',
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#CFE8DF', paddingTop: 14 },
  sampleRow: { fontSize: 12, color: '#17403F', paddingVertical: 2 },
  warnBox: { backgroundColor: '#FFF3D6', borderRadius: 10, padding: 14, marginTop: 14 },

  confirmBox: { backgroundColor: '#E6F6F0', borderRadius: 10, padding: 14 },
  confirmText: { fontSize: 13, color: '#17403F', lineHeight: 20 },

  progressBox: { marginTop: 16 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: '#D5ECE4', overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 5 },
  progressText: { fontSize: 12, color: '#4F6F6B', marginTop: 6 },
  okText: { fontSize: 12, color: '#2E7D32', marginTop: 6, fontWeight: '700' },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#CFE8DF',
  },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#17403F' },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F6F6B',
    backgroundColor: '#E1F2EC',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badgeOk: { color: '#2E7D32', backgroundColor: '#DDEFD9' },
  badgeFail: { color: '#D64545', backgroundColor: '#F6DDD2' },

  errorBox: { backgroundColor: '#F6DDD2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: '#D64545', fontSize: 12, marginTop: 4 },
});