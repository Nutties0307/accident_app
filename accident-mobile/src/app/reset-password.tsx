import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import OrganicHeader from '../components/OrganicHeader';
import AuthBackground from '../components/AuthBackground';

const API_URL =
  Platform.OS === 'web' ? 'http://127.0.0.1:8000' : 'http://192.168.1.43:8000';
const CODE_EXPIRE_SECONDS = 5 * 60;


function ScreenHeader({ height, children }: { height: number; children?: React.ReactNode }) {
  if (Platform.OS !== 'web') {
    return <OrganicHeader height={height}>{children}</OrganicHeader>;
  }
  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: '#2F4A3A',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          right: -90,
          top: -60,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: '#5E7B63',
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -40,
          top: 30,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: '#8FA68A',
          opacity: 0.8,
        }}
      />
      {children}
    </View>
  );
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 900;
  const { email } = useLocalSearchParams();
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(CODE_EXPIRE_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isCodeExpired = secondsLeft === 0;

  const hasLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isPasswordValid = hasLength && hasUpperCase && hasLowerCase && hasNumber;

  const mismatch = confirmPassword !== '' && confirmPassword !== newPassword;

  const handleReset = async () => {
    setCodeError('');
    setPasswordError('');
    setConfirmError('');

    if (isCodeExpired) {
      setCodeError('รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่');
      return;
    }

    if (!resetCode.trim()) {
      setCodeError('กรุณากรอกรหัสยืนยัน');
      return;
    }
    if (!newPassword.trim()) {
      setPasswordError('กรุณากรอกรหัสผ่านใหม่');
      return;
    }
    if (!isPasswordValid) {
      setPasswordError('รหัสผ่านไม่ตรงตามเงื่อนไขด้านล่าง');
      return;
    }
    if (!confirmPassword) {
      setConfirmError('กรุณายืนยันรหัสผ่านใหม่');
      return;
    }
    if (confirmPassword !== newPassword) {
      setConfirmError('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reset_code: resetCode, new_password: newPassword }),
      });
      const data = await response.json();

      if (response.ok) {
        if (Platform.OS === 'web') {
          setSuccessMsg('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กำลังไปหน้าเข้าสู่ระบบ...');
          setTimeout(() => router.replace('/'), 1500);
        } else {
          Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
          router.replace('/');
        }
      } else {
        if (data.detail === 'รหัสยืนยันไม่ถูกต้อง') {
          setCodeError('รหัสยืนยันไม่ถูกต้อง');
        } else if (data.detail === 'รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่') {
          setCodeError('รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่');
          setSecondsLeft(0);
        } else {
          Alert.alert('ไม่สำเร็จ', data.detail || 'กรุณาลองใหม่');
        }
      }
    } catch (error) {
      Alert.alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isCodeExpired) return;

    setIsResending(true);
    setCodeError('');
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        setResetCode('');
        setSecondsLeft(CODE_EXPIRE_SECONDS);
        Alert.alert('ส่งแล้ว', 'ส่งรหัสยืนยันใหม่ไปยังอีเมลของคุณแล้ว');
      } else {
        Alert.alert('ส่งไม่สำเร็จ', data.detail || 'กรุณาลองใหม่');
      }
    } catch (error) {
      Alert.alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่');
    } finally {
      setIsResending(false);
    }
  };

  const formBody = (
    <>


            <View style={styles.inputContainer}>
              <View style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}>
                <Text style={styles.floatingLabelText}>รหัสยืนยัน 6 หลัก</Text>
              </View>
              <TextInput
                style={[styles.input,
                  isWide && styles.wideInput, codeError !== '' && styles.inputError]}
                placeholder="000000"
                placeholderTextColor="#A8967D"
                value={resetCode}
                onChangeText={(text) => { setResetCode(text); setCodeError(''); }}
                keyboardType="number-pad"
                maxLength={6}
              />
              {codeError !== '' && <Text style={styles.errorText}>{codeError}</Text>}

              <View style={styles.timerRow}>
                {!isCodeExpired ? (
                  <Text style={styles.timerText}>รหัสหมดอายุใน {formatTime(secondsLeft)} นาที</Text>
                ) : (
                  <Text style={styles.timerExpiredText}>รหัสหมดอายุแล้ว</Text>
                )}

                <TouchableOpacity
                  onPress={handleResendCode}
                  disabled={!isCodeExpired || isResending}
                >
                  <Text style={[
                    styles.resendText,
                    (!isCodeExpired || isResending) && styles.resendTextDisabled,
                  ]}>
                    {isResending ? 'กำลังส่ง...' : 'ส่งรหัสใหม่'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}>
                <Text style={styles.floatingLabelText}>รหัสผ่านใหม่</Text>
              </View>
              <TextInput
                style={[styles.input,
                  isWide && styles.wideInput, passwordError !== '' && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor="#A8967D"
                value={newPassword}
                onChangeText={(text) => { setNewPassword(text); setPasswordError(''); setConfirmError(''); }}
                secureTextEntry
              />
              {passwordError !== '' && <Text style={styles.errorText}>{passwordError}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <View style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}>
                <Text style={styles.floatingLabelText}>ยืนยันรหัสผ่านใหม่</Text>
              </View>
              <TextInput
                style={[styles.input,
                  isWide && styles.wideInput, (mismatch || confirmError !== '') && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor="#A8967D"
                value={confirmPassword}
                onChangeText={(text) => { setConfirmPassword(text); setConfirmError(''); }}
                secureTextEntry
              />
              {mismatch && <Text style={styles.errorText}>รหัสผ่านไม่ตรงกัน</Text>}
              {!mismatch && confirmError !== '' && <Text style={styles.errorText}>{confirmError}</Text>}
            </View>

            <View style={[styles.passwordRequirementBox, isWide && styles.wideBox]}>
              <Text style={styles.requirementTitle}>ข้อกำหนดรหัสผ่าน</Text>
              <Text style={[styles.reqText, hasLength && styles.reqPassed]}>{hasLength ? '✓' : '•'} อย่างน้อย 8 ตัวอักษร</Text>
              <Text style={[styles.reqText, hasUpperCase && styles.reqPassed]}>{hasUpperCase ? '✓' : '•'} มีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว</Text>
              <Text style={[styles.reqText, hasLowerCase && styles.reqPassed]}>{hasLowerCase ? '✓' : '•'} มีตัวพิมพ์เล็กอย่างน้อย 1 ตัว</Text>
              <Text style={[styles.reqText, hasNumber && styles.reqPassed]}>{hasNumber ? '✓' : '•'} มีตัวเลขอย่างน้อย 1 ตัว</Text>
            </View>

            {successMsg !== '' && <Text style={styles.successText}>{successMsg}</Text>}

            <TouchableOpacity
              style={[styles.mainButton,
                isWide && styles.wideButton, isLoading && styles.buttonDisabled]}
              onPress={handleReset}
              disabled={isLoading}
            >
              <Text style={styles.mainButtonText}>
                {isLoading ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
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

            <Text style={styles.wideTitle}>ตั้งรหัสผ่านใหม่</Text>
            <Text style={styles.wideSubtitle}>กรอกรหัสยืนยันที่ส่งไปยัง {email}</Text>
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
            <ScreenHeader height={220}>
              <View style={styles.headerTextOverlay}>
                <Text style={styles.brandLabel}>SAFEROUTE</Text>
                <Text style={styles.welcomeTitle}>ตั้งรหัสผ่านใหม่</Text>
                <Text style={styles.welcomeSubtitle}>กรอกรหัสยืนยันที่ส่งไปยัง {email}</Text>
              </View>
            </ScreenHeader>
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
  scrollContainer: { flexGrow: 1, width: '100%', maxWidth: 420, alignSelf: 'center' },
  headerWrapper: { position: 'relative' },
  headerTextOverlay: { position: 'absolute', bottom: 30, left: 28, right: 28 },
  brandLabel: { fontSize: 12, fontWeight: '700', color: '#F0D9A8', letterSpacing: 2, marginBottom: 10 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  welcomeSubtitle: { fontSize: 12, color: '#E5D8C0' },
  bottomCard: { backgroundColor: '#E8DCC8', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, paddingHorizontal: 28, paddingTop: 36, paddingBottom: 32, flex: 1 },
  inputContainer: { position: 'relative', marginBottom: 20, marginTop: 6 },
  floatingLabelBox: { position: 'absolute', top: -10, left: 14, backgroundColor: '#E8DCC8', paddingHorizontal: 6, zIndex: 2 },
  floatingLabelText: { fontSize: 12, fontWeight: '700', color: '#6B5638' },
  input: { borderWidth: 1.5, borderColor: '#C9B8A0', borderRadius: 10, paddingHorizontal: 16, height: 50, fontSize: 15, color: '#3A2D1F', backgroundColor: '#F5EDE0' },
  inputError: { borderColor: '#D64545' },
  errorText: { color: '#D64545', fontSize: 11, marginTop: 4, marginLeft: 4 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingHorizontal: 4 },
  timerText: { fontSize: 12, color: '#8A7458' },
  timerExpiredText: { fontSize: 12, color: '#B5562E', fontWeight: '600' },
  resendText: { fontSize: 12, color: '#C08A28', fontWeight: '700' },
  resendTextDisabled: { color: '#C9B8A0' },
  passwordRequirementBox: { backgroundColor: '#DCCDAF', padding: 12, borderRadius: 10, marginBottom: 24, marginTop: 12 },
  requirementTitle: { fontSize: 12, fontWeight: '700', color: '#3A2D1F', marginBottom: 6 },
  reqText: { fontSize: 12, color: '#8A7458', marginBottom: 3 },
  reqPassed: { color: '#5C6B4C', fontWeight: '700' },
  mainButton: { backgroundColor: '#C08A28', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  successText: { color: '#5C6B4C', fontSize: 13, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  buttonDisabled: { opacity: 0.6 },
  mainButtonText: { color: '#F5EDE0', fontSize: 16, fontWeight: '700' },
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
  wideBox: { backgroundColor: 'rgba(27,127,121,0.10)' },
  wideButton: {
    backgroundColor: '#1F8F7C',
    borderRadius: 14,
    height: 54,
    shadowColor: '#1F8F7C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  wideLink: { color: '#1B7F79' },
});