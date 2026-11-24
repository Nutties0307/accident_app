import React, { useCallback, useState } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AuthBackground from '../components/AuthBackground';
import { clearSession, getSession, Session } from '../utils/session';

export default function AccountScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 900;

  const [session, setSession] = useState<Session | null>(null);
  const [confirming, setConfirming] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSession().then((s) => {
        if (active) setSession(s);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const handleLogout = async () => {
    await clearSession();
    router.replace('/');
  };

  return (
    <View style={[styles.container, isWide && styles.wideContainer]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {isWide ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
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

      {isWide ? (
        <View style={styles.wideHeaderWrap}>
          <View style={[styles.glass, styles.wideHeaderCard]}>
            <View style={styles.wideHeaderIcon}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
            <Text style={styles.wideHeaderTitle}>บัญชี</Text>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>บัญชี</Text>
        </View>
      )}

      <View style={[styles.body, isWide && styles.wideBody]}>
        <View style={isWide ? [styles.glass, styles.wideProfile] : styles.plainWrap}>
        <View style={[styles.avatar, isWide && styles.wideAvatar]}>
          <Ionicons name="person" size={44} color="#fff" />
        </View>

        {session ? (
          <>
            <Text style={[styles.name, isWide && styles.wideName]}>{session.name || 'ผู้ใช้'}</Text>
            {session.email ? (
              <Text style={styles.email}>{session.email}</Text>
            ) : null}

            {session.isAdmin === true && Platform.OS === 'web' ? (
              <TouchableOpacity
                style={[styles.adminButton, isWide && styles.wideTeal]}
                onPress={() => router.replace('/admin' as any)}
              >
                <Ionicons name="settings-outline" size={20} color="#fff" />
                <Text style={styles.logoutText}>กลับไปหน้าจัดการข้อมูล (แอดมิน)</Text>
              </TouchableOpacity>
            ) : null}

            {confirming ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  ต้องการออกจากระบบใช่ไหม?
                </Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setConfirming(false)}
                  >
                    <Text style={styles.cancelText}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                  >
                    <Text style={styles.logoutText}>ออกจากระบบ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.logoutOutline}
                onPress={() => setConfirming(true)}
              >
                <Ionicons name="log-out-outline" size={20} color="#C62828" />
                <Text style={styles.logoutOutlineText}>ออกจากระบบ</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.email}>ยังไม่ได้เข้าสู่ระบบ</Text>
            <TouchableOpacity
              style={[styles.loginButton, isWide && styles.wideTeal]}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.logoutText}>ไปหน้าเข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </>
        )}
        </View>
      </View>

      <View style={[styles.bottomNav, isWide && styles.wideNav]}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.replace('/home')}
        >
          <Ionicons name="map-outline" size={25} color="#5B6B6A" />
          <Text style={styles.navText}>แผนที่</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={() => router.replace('/search')}
        >
          <Ionicons name="bookmark-outline" size={25} color="#5B6B6A" />
          <Text style={styles.navText}>ที่บันทึกไว้</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} activeOpacity={0.7}>
          <Ionicons name="person" size={25} color={isWide ? '#1F8F7C' : '#1976D2'} />
          <Text style={[styles.navText, styles.navTextActive, isWide && { color: '#1F8F7C' }]}>บัญชี</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  wideContainer: { backgroundColor: '#C8F0E0' },
  plainWrap: { alignItems: 'center', width: '100%' },
  glass: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
          boxShadow: '0 12px 40px rgba(15,90,98,0.18)',
        } as any)
      : {}),
  },
  wideHeaderWrap: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 22,
  },
  wideHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 24,
  },
  wideHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1F8F7C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideHeaderTitle: { fontSize: 24, fontWeight: '800', color: '#0F5A62' },
  wideBody: { justifyContent: 'center', paddingTop: 0, paddingBottom: 90 },
  wideProfile: {
    alignItems: 'center',
    width: 420,
    maxWidth: '100%',
    paddingVertical: 40,
    paddingHorizontal: 32,
    borderRadius: 28,
  },
  wideAvatar: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#1F8F7C' },
  wideName: { fontSize: 24, fontWeight: '800', color: '#0F5A62' },
  wideTeal: { backgroundColor: '#1F8F7C', borderRadius: 14 },
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

  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'web' ? 18 : 52,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#222' },

  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#222' },
  email: { fontSize: 14, color: '#777', marginTop: 4 },

  adminButton: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1976D2',
  },

  logoutOutline: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C62828',
    backgroundColor: '#fff',
  },
  logoutOutlineText: { color: '#C62828', fontWeight: '700', fontSize: 15 },

  confirmBox: {
    marginTop: 32,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    gap: 14,
  },
  confirmText: { fontSize: 15, color: '#333' },
  confirmRow: { flexDirection: 'row', gap: 10 },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  cancelText: { color: '#444', fontWeight: '600' },
  logoutButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#C62828',
  },
  loginButton: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1976D2',
  },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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