import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const API_URL = (() => {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  }

  // Expo Go บนเครื่องจริงใช้ host เดียวกับที่ Expo เสิร์ฟ bundle
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:8000`;
  }

  // เฉพาะ Android Emulator
  return 'http://10.0.2.2:8000';
})();