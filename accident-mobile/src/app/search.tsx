import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { API_URL } from '../utils/api';
import { getSession } from '../utils/session';
import AuthBackground from '../components/AuthBackground';

type SavedMap = {
  id: number;
  title: string;
  start_name: string | null;
  end_name: string | null;
  image_url: string;
  summary: {
    total_km?: number;
    high_risk_points?: number;
  } | null;
  created_at: string;
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatThaiDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${hh}:${mm} น.`;
}

// รูปที่ยาวไม่เท่ากัน -> อ่านขนาดจริงเพื่อให้แสดงเต็มรูป ไม่โดนตัดแถบสรุปด้านล่าง
function MapImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(0.55);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setRatio(w / h);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: ratio, backgroundColor: '#e5e7eb' }}
      resizeMode="contain"
    />
  );
}

const GRID_PADDING = 14;
const GRID_GAP = 14;

export default function SavedMapsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  // แกลเลอรี: บนเว็บจอกว้างจำกัดความกว้างเนื้อหาให้อยู่กลางจอ แล้วแบ่ง 3 คอลัมน์
  const isWideWeb = Platform.OS === 'web' && screenWidth >= 900;
  const contentWidth = isWideWeb ? Math.min(screenWidth, 1180) : screenWidth;
  const columns = contentWidth >= 1000 ? 3 : 2;
  const cardWidth =
    (contentWidth - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns;

  const [maps, setMaps] = useState<SavedMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const [viewing, setViewing] = useState<SavedMap | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const session = await getSession();

      if (!session) {
        setNeedLogin(true);
        setMaps([]);
        return;
      }

      setNeedLogin(false);

      const response = await fetch(
        `${API_URL}/api/saved-maps?user_id=${session.userId}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : 'โหลดแผนที่ที่บันทึกไว้ไม่สำเร็จ'
        );
      }

      setMaps(Array.isArray(data?.maps) ? data.maps : []);
    } catch (e: any) {
      console.error('โหลดแผนที่ที่บันทึกไว้ไม่สำเร็จ:', e);
      setError(e?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // โหลดใหม่ทุกครั้งที่กลับมาหน้านี้ (เช่น เพิ่งบันทึกจากหน้าแผนที่)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = async (map: SavedMap) => {
    const session = await getSession();
    if (!session) {
      setNeedLogin(true);
      return;
    }

    setDeletingId(map.id);

    try {
      const response = await fetch(
        `${API_URL}/api/saved-maps/${map.id}?user_id=${session.userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data?.detail === 'string' ? data.detail : 'ลบไม่สำเร็จ'
        );
      }

      setMaps((prev) => prev.filter((m) => m.id !== map.id));
      setConfirmId(null);
      setViewing((v) => (v && v.id === map.id ? null : v));
    } catch (e: any) {
      console.error('ลบแผนที่ไม่สำเร็จ:', e);
      setError(e?.message || 'ลบไม่สำเร็จ');
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const renderItem = ({ item }: { item: SavedMap }) => {
    const confirming = confirmId === item.id;
    const deleting = deletingId === item.id;

    const km = item.summary?.total_km;
    const high = item.summary?.high_risk_points;

    return (
      <View style={[styles.card, isWideWeb && styles.wideCardBox, { width: cardWidth }]}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/saved-map?id=${item.id}` as any)}>
          <View style={styles.thumbBox}>
            <Image
              source={{ uri: `${API_URL}${item.image_url}` }}
              style={styles.thumbImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={styles.cardRoute} numberOfLines={1}>
            {item.start_name || 'ต้นทาง'} → {item.end_name || 'ปลายทาง'}
          </Text>

          <View style={styles.chipRow}>
            {typeof km === 'number' ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{km.toFixed(1)} กม.</Text>
              </View>
            ) : null}
            {typeof high === 'number' ? (
              <View style={[styles.chip, high > 0 ? styles.chipDanger : styles.chipOk]}>
                <Text
                  style={[
                    styles.chipText,
                    high > 0 ? styles.chipDangerText : styles.chipOkText,
                  ]}
                >
                  {high > 0 ? `เสี่ยงสูง ${high} จุด` : 'ไม่พบจุดเสี่ยงสูง'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.cardDate} numberOfLines={1}>
              {formatThaiDateTime(item.created_at)}
            </Text>

            {confirming ? (
              <View style={styles.confirmRow}>
                <TouchableOpacity
                  style={styles.confirmCancel}
                  onPress={() => setConfirmId(null)}
                  disabled={deleting}
                >
                  <Text style={styles.confirmCancelText}>ยกเลิก</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmDelete}
                  onPress={() => handleDelete(item)}
                  disabled={deleting}
                >
                  <Text style={styles.confirmDeleteText}>
                    {deleting ? '...' : 'ลบ'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.trashButton}
                onPress={() => setConfirmId(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#C62828" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, isWideWeb && styles.wideContainer]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {isWideWeb ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { overflow: 'hidden' },
          ]}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              ({ filter: 'blur(14px)', transform: [{ scale: 1.08 }] } as any),
            ]}
          >
            <AuthBackground />
          </View>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(235,252,245,0.35)' },
            ]}
          />
        </View>
      ) : null}

      {isWideWeb ? (
        <View style={styles.wideHeaderWrap}>
          <View style={styles.wideHeaderCard}>
            <View style={styles.wideHeaderIcon}>
              <Ionicons name="bookmark" size={22} color="#fff" />
            </View>
            <Text style={styles.wideHeaderTitle}>แผนที่ที่บันทึกไว้</Text>
            {!needLogin && (
              <Text style={styles.wideHeaderCount}>{maps.length} รายการ</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>แผนที่ที่บันทึกไว้</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={isWideWeb ? '#1F8F7C' : '#1976D2'} />
        </View>
      ) : needLogin ? (
        <View style={styles.stateWrap}>
          <View style={[styles.stateCard, isWideWeb && styles.stateCardWide]}>
            <View style={[styles.stateIcon, isWideWeb && styles.stateIconWide]}>
              <Ionicons name="lock-closed" size={28} color="#fff" />
            </View>
            <Text style={styles.stateTitle}>เข้าสู่ระบบเพื่อดูแผนที่ที่บันทึกไว้</Text>
            <Text style={styles.stateDesc}>
              สมาชิกบันทึกเส้นทางไว้ดูภายหลังได้
            </Text>
            <TouchableOpacity
              style={[styles.stateButton, isWideWeb && styles.stateButtonWide]}
              activeOpacity={0.85}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.stateButtonText}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.stateLink}>ยังไม่มีบัญชี? สมัครสมาชิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          key={columns}
          numColumns={columns}
          columnWrapperStyle={
            isWideWeb
              ? { gap: GRID_GAP, justifyContent: 'center' }
              : { gap: GRID_GAP }
          }
          style={{ width: '100%', maxWidth: 1180, alignSelf: 'center' }}
          data={maps}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, isWideWeb && styles.wideListContent]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
          ListHeaderComponent={
            error ? <Text style={styles.errorText}>{error}</Text> : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.stateWrap}>
                <View style={[styles.stateCard, isWideWeb && styles.stateCardWide]}>
                  <View style={[styles.stateIcon, isWideWeb && styles.stateIconWide]}>
                    <Ionicons name="bookmark" size={28} color="#fff" />
                  </View>
                  <Text style={styles.stateTitle}>ยังไม่มีแผนที่ที่บันทึกไว้</Text>
                  <Text style={styles.stateDesc}>
                    ค้นหาเส้นทางในหน้าแผนที่ แล้วกด "บันทึกแผนที่"
                  </Text>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* ดูรูปเต็ม */}
      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewing(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {viewing && (
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              maximumZoomScale={4}
              minimumZoomScale={1}
            >
              <View
                style={{
                  width: '100%',
                  maxWidth: 560,
                  alignSelf: 'center',
                }}
              >
                <MapImage uri={`${API_URL}${viewing.image_url}`} />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* BOTTOM NAV */}
      <View style={[styles.bottomNav, isWideWeb && styles.wideNav]}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.replace('/home')}
        >
          <Ionicons name="map-outline" size={25} color="#5B6B6A" />
          <Text style={styles.navText}>แผนที่</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Ionicons name="bookmark" size={25} color={isWideWeb ? '#1F8F7C' : '#1976D2'} />
          <Text style={[styles.navText, styles.navTextActive, isWideWeb && styles.wideNavTextActive]}>
            ที่บันทึกไว้
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.push('/account')}
        >
          <Ionicons name="person-outline" size={25} color="#5B6B6A" />
          <Text style={styles.navText}>บัญชี</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  wideContainer: { backgroundColor: '#C8F0E0' },

  wideHeaderWrap: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 6,
  },
  wideHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.55)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 12px 40px rgba(15,90,98,0.18)',
        } as any)
      : {}),
  },
  wideHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1F8F7C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideHeaderTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: '#0F5A62' },
  wideHeaderCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B7F79',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stateWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 36,
    paddingHorizontal: 24,
  },
  stateCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  stateCardWide: {
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 10px 30px rgba(15,90,98,0.16)',
        } as any)
      : {}),
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stateIconWide: { backgroundColor: '#1F8F7C' },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17403F',
    textAlign: 'center',
    marginBottom: 6,
  },
  stateDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4F6F6B',
    textAlign: 'center',
    marginBottom: 22,
  },
  stateButton: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateButtonWide: { backgroundColor: '#1F8F7C' },
  stateButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stateLink: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '700',
    color: '#1B7F79',
  },
  wideEmptyCard: {
    flex: 0,
    alignSelf: 'center',
    marginTop: 40,
    paddingVertical: 40,
    paddingHorizontal: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
        } as any)
      : {}),
  },
  widePrimaryButton: { backgroundColor: '#1F8F7C', borderRadius: 14 },
  wideListContent: { paddingTop: 14, paddingBottom: 130 },
  wideCardBox: {
    borderRadius: 24,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 30px rgba(15,90,98,0.18)' } as any)
      : {}),
  },
  wideNav: {
    left: '50%' as any,
    right: 'auto' as any,
    marginLeft: -190,
    width: 380,
    bottom: 22,
    height: 66,
    borderRadius: 33,
    borderTopWidth: 0,
    paddingBottom: 0,
    backgroundColor: 'rgba(255,255,255,0.78)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 12px 36px rgba(15,90,98,0.28)',
        } as any)
      : {}),
  },
  wideNavTextActive: { color: '#1F8F7C' },

  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'web' ? 18 : 52,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#222' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyText: { fontSize: 15, color: '#555', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 14,
  },

  primaryButton: {
    marginTop: 8,
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  listContent: { padding: 14, paddingBottom: 100, flexGrow: 1 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: GRID_GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  thumbBox: {
    width: '100%',
    aspectRatio: 0.85,
    backgroundColor: '#e5e7eb',
  },
  thumbImage: { width: '100%', height: '100%' },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
  cardRoute: { fontSize: 12.5, color: '#555', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: '#eef2f6',
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, color: '#3e4c59', fontWeight: '600' },
  chipDanger: { backgroundColor: '#fdecea' },
  chipDangerText: { color: '#b71c1c' },
  chipOk: { backgroundColor: '#e8f5e9' },
  chipOkText: { color: '#2e7d32' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  cardDate: { flex: 1, fontSize: 12, color: '#888' },

  trashButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  confirmCancelText: { color: '#444', fontWeight: '600' },
  confirmDelete: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#C62828',
  },
  confirmDeleteText: { color: '#fff', fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center' },

  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 12 : 4,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
  },
  navText: { fontSize: 12, color: '#666', marginTop: 4, fontWeight: '500' },
  navTextActive: { color: '#1976D2', fontWeight: '700' },
});