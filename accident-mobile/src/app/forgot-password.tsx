import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, StatusBar, ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import OrganicHeader from '../components/OrganicHeader';
import AuthBackground from '../components/AuthBackground';

// บนเว็บใช้เครื่องเดียวกับ backend; บนมือถือยังใช้ IP เดิม
const API_URL =
  Platform.OS === 'web' ? 'http://127.0.0.1:8000' : 'http://192.168.1.43:8000';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 900;
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const handleSendCode = async () => {
    setEmailError('');

    if (!email.trim()) {
      setEmailError('กรุณากรอกอีเมล');
      return;
    }
    if (!emailRegex.test(email)) {
      setEmailError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        router.push({ pathname: '/reset-password', params: { email } });
      } else {
        if (data.detail === 'ไม่พบอีเมลนี้ในระบบ') {
          setEmailError('อีเมลนี้ยังไม่เคยสมัครสมาชิก');
        } else {
          if (Platform.OS === 'web') setEmailError(data.detail || 'ส่งไม่สำเร็จ กรุณาลองใหม่');
          else Alert.alert('ส่งไม่สำเร็จ', data.detail || 'กรุณาลองใหม่');
        }
      }
    } catch (error) {
      if (Platform.OS === 'web') setEmailError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
      else Alert.alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่');
    } finally {
      setIsLoading(false);
    }
  };

  const formBody = (
    <>
            <View style={styles.inputContainer}>
              <View style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}>
                <Text style={styles.floatingLabelText}>อีเมล</Text>
              </View>
              <TextInput
                style={[styles.input, isWide && styles.wideInput, emailError !== '' && styles.inputError]}
                placeholder="name@example.com"
                placeholderTextColor="#A8967D"
                value={email}
                onChangeText={(text) => { setEmail(text); setEmailError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailError !== '' && <Text style={styles.errorText}>{emailError}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.mainButton, isWide && styles.wideButton, isLoading && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={isLoading}
            >
              <Text style={styles.mainButtonText}>
                {isLoading ? 'กำลังส่งรหัส...' : 'ส่งรหัสยืนยัน'}
              </Text>
            </TouchableOpacity>
          </>
  );

  if (isWide) {
    return (
      <View style={styles.wideRoot}>
        <AuthBackground />
        <ScrollView
          contentContainerStyle={styles.wideScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.wideCard,
              { backdropFilter: 'blur(22px) saturate(1.5)', WebkitBackdropFilter: 'blur(22px) saturate(1.5)' } as any,
            ]}
          >
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.wideBack}>← ย้อนกลับ</Text>
            </TouchableOpacity>
            <Text style={styles.wideTitle}>ลืมรหัสผ่าน</Text>
            <Text style={styles.wideSubtitle}>กรอกอีเมลเพื่อรับรหัสยืนยันตั้งรหัสผ่านใหม่</Text>
            <View style={{ height: 14 }} />
            {formBody}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A3B26" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>

          <View style={styles.headerWrapper}>
            <OrganicHeader height={230}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>← ย้อนกลับ</Text>
              </TouchableOpacity>
              <View style={styles.headerTextOverlay}>
                <Text style={styles.brandLabel}>SAFEROUTE</Text>
                <Text style={styles.welcomeTitle}>ลืมรหัสผ่าน</Text>
                <Text style={styles.welcomeSubtitle}>กรอกอีเมลเพื่อรับรหัสยืนยันตั้งรหัสผ่านใหม่</Text>
              </View>
            </OrganicHeader>
          </View>

          <View style={styles.bottomCard}>
            {formBody}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#4A3B26' },
  scrollContainer: { flexGrow: 1 },
  headerWrapper: { position: 'relative' },
  backButton: { position: 'absolute', top: 20, left: 28, zIndex: 10 },
  backButtonText: { color: '#F0D9A8', fontSize: 14, fontWeight: '600' },
  headerTextOverlay: { position: 'absolute', bottom: 36, left: 28, right: 28 },
  brandLabel: { fontSize: 12, fontWeight: '700', color: '#F0D9A8', letterSpacing: 2, marginBottom: 10 },
  welcomeTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  welcomeSubtitle: { fontSize: 13, color: '#E5D8C0', lineHeight: 18 },
  bottomCard: { backgroundColor: '#E8DCC8', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 32, flex: 1 },
  inputContainer: { position: 'relative', marginBottom: 24, marginTop: 6 },
  floatingLabelBox: { position: 'absolute', top: -10, left: 14, backgroundColor: '#E8DCC8', paddingHorizontal: 6, zIndex: 2 },
  floatingLabelText: { fontSize: 12, fontWeight: '700', color: '#6B5638' },
  input: { borderWidth: 1.5, borderColor: '#C9B8A0', borderRadius: 10, paddingHorizontal: 16, height: 50, fontSize: 15, color: '#3A2D1F', backgroundColor: '#F5EDE0' },
  inputError: { borderColor: '#D64545' },
  errorText: { color: '#D64545', fontSize: 11, marginTop: 4, marginLeft: 4 },
  mainButton: { backgroundColor: '#C08A28', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  mainButtonText: { color: '#F5EDE0', fontSize: 16, fontWeight: '700' },
  /* ---------- จอกว้าง (เว็บ) ---------- */
  wideRoot: { flex: 1, backgroundColor: '#C8F0E0' },
  wideScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  wideCard: {
    width: '100%',
    maxWidth: 480,
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 40,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#0A3F4E',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.28,
    shadowRadius: 48,
  },
  wideBack: { color: '#1B7F79', fontSize: 14, fontWeight: '700', marginBottom: 14 },
  wideTitle: { fontSize: 30, fontWeight: '800', color: '#0F5A62' },
  wideSubtitle: { fontSize: 13, color: '#3F6B6B', marginTop: 4 },
  wideLabelBox: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingVertical: 1 },
  wideInput: { backgroundColor: '#FFFFFF', borderColor: '#D5DAE0', borderRadius: 14, height: 54, color: '#1F2933' },
  wideButton: {
    backgroundColor: '#1F8F7C',
    borderRadius: 14,
    height: 54,
    shadowColor: '#1F8F7C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
});