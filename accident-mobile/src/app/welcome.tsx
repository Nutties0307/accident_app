import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthBackground from '../components/AuthBackground';

export default function WelcomeScreen() {
  const router = useRouter();

  // จำไว้ว่าเห็นหน้าต้อนรับแล้ว (หน้าเข้าสู่ระบบจะไม่เด้งกลับมาที่นี่อีกจนกว่าจะโหลดหน้าใหม่)
  const markSeen = () => {
    (globalThis as any).__srWelcomeShown = true;
  };

  // เริ่มต้นใช้งาน -> ไปหน้าแผนที่เลย (เข้าแบบผู้เยี่ยมชม ถ้ายังไม่ได้เข้าสู่ระบบ)
  const start = () => {
    markSeen();
    router.replace('/home');
  };

  const goLogin = () => {
    markSeen();
    router.replace('/');
  };

  const goRegister = () => {
    markSeen();
    router.push('/register');
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthBackground />

      <View style={styles.center}>
        <View
          style={[
            styles.card,
            Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(22px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
                } as any)
              : null,
          ]}
        >
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={60} color="#1B8F7C" />
          </View>

          <Text style={styles.brand}>SAFEROUTE</Text>
          <Text style={styles.heading}>ยินดีต้อนรับ</Text>
          <Text style={styles.desc}>
            แจ้งเตือนจุดเสี่ยงอุบัติเหตุสะสมบนเส้นทางที่คุณเดินทาง
          </Text>

          <TouchableOpacity
            style={styles.startButton}
            activeOpacity={0.85}
            onPress={start}
          >
            <Text style={styles.startText}>เริ่มต้นใช้งาน</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>ยังไม่มีบัญชีผู้ใช้? </Text>
            <TouchableOpacity onPress={goRegister}>
              <Text style={styles.footerLink}>สมัครสมาชิก</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.footerRow, { marginTop: 10 }]}>
            <Text style={styles.footerText}>มีบัญชีอยู่แล้ว? </Text>
            <TouchableOpacity onPress={goLogin}>
              <Text style={styles.footerLink}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#C8F0E0',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#0F5A62',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },

  badge: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#1B7F79',
    marginBottom: 8,
  },

  heading: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F5A62',
    marginBottom: 10,
  },

  desc: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4F6F6B',
    textAlign: 'center',
    marginBottom: 30,
  },

  startButton: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1F8F7C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },

  footerText: {
    color: '#4F6F6B',
    fontSize: 13,
  },

  footerLink: {
    color: '#1B7F79',
    fontSize: 13,
    fontWeight: '700',
  },
});