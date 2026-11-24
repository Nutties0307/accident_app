import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import OrganicHeader from '../components/OrganicHeader';
import AuthBackground from '../components/AuthBackground';

// ========================================
// API URL
// ========================================

const API_URL = (() => {
  // Web บนคอมพิวเตอร์
  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  }

  // Android มือถือจริง / Expo Go
  if (Platform.OS === 'android') {
    const hostUri = Constants.expoConfig?.hostUri;

    if (hostUri) {
      const host = hostUri.split(':')[0];

      if (
        host &&
        host !== '127.0.0.1' &&
        host !== 'localhost'
      ) {
        return `http://${host}:8000`;
      }
    }

    // Android Emulator
    return 'http://10.0.2.2:8000';
  }

  // iPhone / iPad
  const hostUri = Constants.expoConfig?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];

    if (
      host &&
      host !== '127.0.0.1' &&
      host !== 'localhost'
    ) {
      return `http://${host}:8000`;
    }
  }

  return 'http://127.0.0.1:8000';
})();

console.log('SAFE ROUTE REGISTER API URL:', API_URL);
console.log('PLATFORM:', Platform.OS);

// ========================================
// Register Screen
// ========================================


/* หัวหน้าจอ: บนเว็บใช้หัวแบบเรียบที่กว้างตามคอลัมน์ ส่วนบนมือถือใช้ OrganicHeader เดิม */
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

export default function RegisterScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 900;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  // Error แยกแต่ละช่อง
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // ========================================
  // Password validation
  // ========================================

  const hasLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  const isPasswordValid =
    hasLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumber;

  // ========================================
  // Email validation
  // ========================================

  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const isEmailFormatValid =
    email.length === 0 ||
    emailRegex.test(email);

  // ========================================
  // Register
  // ========================================

  const handleRegister = async () => {
    // เคลียร์ error เก่า
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmError('');
    setFormError('');

    let hasError = false;

    // ========================================
    // ตรวจสอบชื่อ
    // ========================================

    if (!fullName) {
      setNameError('กรุณากรอกชื่อ-นามสกุล');
      hasError = true;
    }

    // ========================================
    // ตรวจสอบ Email
    // ========================================

    if (!email) {
      setEmailError('กรุณากรอกอีเมล');
      hasError = true;
    } else if (!emailRegex.test(email)) {
      setEmailError('รูปแบบอีเมลไม่ถูกต้อง');
      hasError = true;
    }

    // ========================================
    // ตรวจสอบ Password
    // ========================================

    if (!password) {
      setPasswordError('กรุณากรอกรหัสผ่าน');
      hasError = true;
    } else if (!isPasswordValid) {
      setPasswordError(
        'รหัสผ่านไม่ตรงตามเงื่อนไขด้านล่าง'
      );
      hasError = true;
    }

    // ตรวจสอบยืนยันรหัสผ่าน
    if (!confirmPassword) {
      setConfirmError('กรุณายืนยันรหัสผ่าน');
      hasError = true;
    } else if (confirmPassword !== password) {
      setConfirmError('รหัสผ่านไม่ตรงกัน');
      hasError = true;
    }

    // ถ้ามี error ไม่ต้องส่งข้อมูล
    if (hasError) {
      return;
    }

    setIsLoading(true);

    try {
      // ========================================
      // Debug
      // ========================================

      console.log('====================================');
      console.log('REGISTER');
      console.log('API URL:', API_URL);
      console.log('NAME:', JSON.stringify(fullName));
      console.log('EMAIL:', JSON.stringify(email));
      console.log('EMAIL LENGTH:', email.length);
      console.log('====================================');

      // ========================================
      // ส่งข้อมูลไป Backend
      //
      // สำคัญ:
      // email ถูกส่งตามที่ผู้ใช้พิมพ์
      // ไม่มี toLowerCase()
      // ไม่มี trim()
      // ========================================

      const response = await fetch(
        `${API_URL}/register`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            name: fullName,
            email: email,
            password: password,
          }),
        }
      );

      // ========================================
      // อ่าน Response
      // ========================================

      const data = await response.json();

      console.log(
        'REGISTER STATUS:',
        response.status
      );

      console.log(
        'REGISTER RESPONSE:',
        JSON.stringify(data)
      );

      // ========================================
      // สมัครสำเร็จ
      // ========================================

      if (response.ok) {
        // บนเว็บ Alert.alert ไม่แสดงผล จึงใช้ข้อความในหน้าแทน แล้วไปหน้าเข้าสู่ระบบ
        if (Platform.OS === 'web') {
          setSuccessMsg('สมัครสมาชิกสำเร็จ กำลังไปหน้าเข้าสู่ระบบ...');
          setTimeout(() => router.replace('/'), 1500);
          return;
        }

        Alert.alert(
          'สำเร็จ',
          'ลงทะเบียนบัญชีผู้ใช้เรียบร้อยแล้ว',
          [
            {
              text: 'เข้าสู่หน้าหลัก',
              onPress: () => {
                router.replace('/home');
              },
            },
          ]
        );

        return;
      }

      // ========================================
      // Email ถูกใช้แล้ว
      // ========================================

      if (
        data?.detail ===
        'อีเมลนี้ถูกใช้งานแล้ว'
      ) {
        setEmailError(
          'อีเมลนี้เคยสมัครสมาชิกแล้ว'
        );

        return;
      }

      // ========================================
      // Error อื่นจาก Backend
      // ========================================

      if (Platform.OS === 'web') {
        setFormError(
          (typeof data?.detail === 'string' && data.detail) ||
            'ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        );
        return;
      }

      Alert.alert(
        'ลงทะเบียนไม่สำเร็จ',
        data?.detail ||
          'กรุณาลองใหม่อีกครั้ง'
      );
    } catch (error) {
      console.error(
        'REGISTER ERROR:',
        error
      );

      if (Platform.OS === 'web') {
        setFormError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่');
        return;
      }

      Alert.alert(
        'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
        'กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================
  // UI
  // ========================================

  const formBody = (
    <>

            {/* ========================================
                ชื่อ-นามสกุล
            ======================================== */}

            <View style={styles.inputContainer}>
              <View
                style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}
              >
                <Text
                  style={
                    styles.floatingLabelText
                  }
                >
                  ชื่อ-นามสกุล
                </Text>
              </View>

              <TextInput
                style={[
                  styles.input,
                  isWide && styles.wideInput,
                  nameError !== '' &&
                    styles.inputError,
                ]}
                placeholder="กรอกชื่อของคุณ"
                placeholderTextColor="#A8967D"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setNameError('');
                }}
                autoCapitalize="words"
              />

              {nameError !== '' && (
                <Text
                  style={styles.errorText}
                >
                  {nameError}
                </Text>
              )}
            </View>

            {/* ========================================
                Email
            ======================================== */}

            <View style={styles.inputContainer}>
              <View
                style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}
              >
                <Text
                  style={
                    styles.floatingLabelText
                  }
                >
                  อีเมล
                </Text>
              </View>

              <TextInput
                style={[
                  styles.input,
                  isWide && styles.wideInput,
                  (!isEmailFormatValid ||
                    emailError !== '') &&
                    styles.inputError,
                ]}
                placeholder="name@example.com"
                placeholderTextColor="#A8967D"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setEmailError('');
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {!isEmailFormatValid &&
                emailError === '' && (
                  <Text
                    style={styles.errorText}
                  >
                    รูปแบบอีเมลไม่ถูกต้อง
                  </Text>
                )}

              {emailError !== '' && (
                <Text
                  style={styles.errorText}
                >
                  {emailError}
                </Text>
              )}
            </View>

            {/* ========================================
                Password
            ======================================== */}

            <View style={styles.inputContainer}>
              <View
                style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}
              >
                <Text
                  style={
                    styles.floatingLabelText
                  }
                >
                  รหัสผ่าน
                </Text>
              </View>

              <TextInput
                style={[
                  styles.input,
                  isWide && styles.wideInput,
                  passwordError !== '' &&
                    styles.inputError,
                ]}
                placeholder="••••••••"
                placeholderTextColor="#A8967D"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError('');
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              {passwordError !== '' && (
                <Text
                  style={styles.errorText}
                >
                  {passwordError}
                </Text>
              )}
            </View>

            {/* ========================================
                Confirm Password
            ======================================== */}

            <View style={styles.inputContainer}>
              <View style={[styles.floatingLabelBox, isWide && styles.wideLabelBox]}>
                <Text style={styles.floatingLabelText}>
                  ยืนยันรหัสผ่าน
                </Text>
              </View>

              <TextInput
                style={[
                  styles.input,
                  isWide && styles.wideInput,
                  (confirmError !== '' ||
                    (confirmPassword.length > 0 &&
                      confirmPassword !== password)) &&
                    styles.inputError,
                ]}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                placeholderTextColor="#A8967D"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmError('');
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              {confirmError !== '' ? (
                <Text style={styles.errorText}>{confirmError}</Text>
              ) : confirmPassword.length > 0 &&
                confirmPassword !== password ? (
                <Text style={styles.errorText}>รหัสผ่านไม่ตรงกัน</Text>
              ) : null}
            </View>

            {/* ========================================
                Password Requirements
            ======================================== */}

            <View
              style={[styles.passwordRequirementBox, isWide && styles.wideBox]}
            >
              <Text
                style={styles.requirementTitle}
              >
                ข้อกำหนดรหัสผ่าน
              </Text>

              <Text
                style={[
                  styles.reqText,
                  hasLength &&
                    styles.reqPassed,
                ]}
              >
                {hasLength ? '✓' : '•'} อย่างน้อย
                8 ตัวอักษร
              </Text>

              <Text
                style={[
                  styles.reqText,
                  hasUpperCase &&
                    styles.reqPassed,
                ]}
              >
                {hasUpperCase ? '✓' : '•'} มีตัวพิมพ์ใหญ่
                อย่างน้อย 1 ตัว
              </Text>

              <Text
                style={[
                  styles.reqText,
                  hasLowerCase &&
                    styles.reqPassed,
                ]}
              >
                {hasLowerCase ? '✓' : '•'} มีตัวพิมพ์เล็ก
                อย่างน้อย 1 ตัว
              </Text>

              <Text
                style={[
                  styles.reqText,
                  hasNumber &&
                    styles.reqPassed,
                ]}
              >
                {hasNumber ? '✓' : '•'} มีตัวเลข
                อย่างน้อย 1 ตัว
              </Text>
            </View>

            {formError !== '' && (
              <Text style={[styles.errorText, { marginBottom: 10, fontSize: 13 }]}>
                {formError}
              </Text>
            )}

            {successMsg !== '' && (
              <Text style={[styles.reqPassed, { marginBottom: 10, fontSize: 13 }]}>
                {successMsg}
              </Text>
            )}

            {/* ========================================
                Register Button
            ======================================== */}

            <TouchableOpacity
              style={[
                styles.mainButton,
                isWide && styles.wideButton,
                isLoading &&
                  styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              <Text
                style={
                  styles.mainButtonText
                }
              >
                {isLoading
                  ? 'กำลังสร้างบัญชี...'
                  : 'สมัครสมาชิก'}
              </Text>
            </TouchableOpacity>

            {/* ========================================
                Login Link
            ======================================== */}

            <View style={styles.footerRow}>
              <Text
                style={styles.footerText}
              >
                มีบัญชีผู้ใช้แล้ว?{' '}
              </Text>

              <TouchableOpacity
                onPress={() => router.replace('/')}
              >
                <Text
                  style={[styles.footerLink, isWide && styles.wideLink]}
                >
                  เข้าสู่ระบบ
                </Text>
              </TouchableOpacity>
            </View>
          
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
            <TouchableOpacity onPress={() => router.replace('/')}>
              <Text style={styles.wideBack}>← ย้อนกลับ</Text>
            </TouchableOpacity>
            <Text style={styles.wideTitle}>สมัครสมาชิก</Text>
            <Text style={styles.wideSubtitle}>สร้างบัญชีใหม่เพื่อเริ่มใช้งาน</Text>
            <View style={{ height: 14 }} />
            {formBody}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#4A3B26"
      />

      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContainer
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================
              Header
          ======================================== */}

          <View style={styles.headerWrapper}>
            <ScreenHeader height={260}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace('/')}
              >
                <Text
                  style={styles.backButtonText}
                >
                  ← ย้อนกลับ
                </Text>
              </TouchableOpacity>

              <View
                style={styles.headerTextOverlay}
              >
                <Text style={styles.brandLabel}>
                  SAFEROUTE
                </Text>

                <Text
                  style={styles.welcomeTitle}
                >
                  สมัครสมาชิก
                </Text>

                <Text
                  style={styles.welcomeSubtitle}
                >
                  สร้างบัญชีใหม่เพื่อเริ่มใช้งาน
                </Text>
              </View>
            </ScreenHeader>
          </View>

          {/* ========================================
              Form
          ======================================== */}

          <View style={styles.bottomCard}>
            {formBody}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A3B26',
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  headerWrapper: {
    position: 'relative',
  },

  backButton: {
    position: 'absolute',
    top: 20,
    left: 28,
    zIndex: 10,
  },

  backButtonText: {
    color: '#F0D9A8',
    fontSize: 14,
    fontWeight: '600',
  },

  headerTextOverlay: {
    position: 'absolute',
    bottom: 36,
    left: 28,
    right: 28,
  },

  brandLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F0D9A8',
    letterSpacing: 2,
    marginBottom: 10,
  },

  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },

  welcomeSubtitle: {
    fontSize: 13,
    color: '#E5D8C0',
  },

  bottomCard: {
    backgroundColor: '#E8DCC8',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 32,
  },

  inputContainer: {
    position: 'relative',
    marginBottom: 20,
    marginTop: 6,
  },

  floatingLabelBox: {
    position: 'absolute',
    top: -10,
    left: 14,
    backgroundColor: '#E8DCC8',
    paddingHorizontal: 6,
    zIndex: 2,
  },

  floatingLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B5638',
  },

  input: {
    borderWidth: 1.5,
    borderColor: '#C9B8A0',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: '#3A2D1F',
    backgroundColor: '#F5EDE0',
  },

  inputError: {
    borderColor: '#D64545',
  },

  errorText: {
    color: '#D64545',
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
  },

  passwordRequirementBox: {
    backgroundColor: '#DCCDAF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 24,
  },

  requirementTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3A2D1F',
    marginBottom: 6,
  },

  reqText: {
    fontSize: 12,
    color: '#8A7458',
    marginBottom: 3,
  },

  reqPassed: {
    color: '#5C6B4C',
    fontWeight: '700',
  },

  mainButton: {
    backgroundColor: '#C08A28',
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  mainButtonText: {
    color: '#F5EDE0',
    fontSize: 16,
    fontWeight: '700',
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },

  footerText: {
    color: '#6B5638',
    fontSize: 13,
  },

  footerLink: {
    color: '#B5562E',
    fontSize: 13,
    fontWeight: '700',
  },

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