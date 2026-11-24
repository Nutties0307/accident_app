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

import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import OrganicHeader from '../components/OrganicHeader';
import { clearSession, saveSession } from '../utils/session';

/* =====================================================
   API URL
   ===================================================== */

const API_URL = (() => {
  // Web บนคอม
  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  }

  /*
   * Android เครื่องจริง
   *
   * Expo จะมี hostUri ประมาณ:
   * 192.168.1.100:8081
   *
   * เราจะดึง IP ของคอมออกมา
   * แล้วเปลี่ยน port เป็น 8000
   */
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

    /*
     * กรณี Android Emulator
     * 10.0.2.2 = localhost ของเครื่องคอม
     */
    return 'http://10.0.2.2:8000';
  }

  /*
   * iOS Simulator / อุปกรณ์อื่น
   */
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

console.log('====================================');
console.log('SAFE ROUTE API URL:', API_URL);
console.log('PLATFORM:', Platform.OS);
console.log('====================================');

/* =====================================================
   LOGIN SCREEN
   ===================================================== */


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


/* ภาพประกอบฝั่งซ้าย (เว็บเท่านั้น): ฉากภูเขา ถนน และจุดเสี่ยงแบบ flat */
const HERO_SCENE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" width="100%" height="100%"><defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFF1E0"/><stop offset=".5" stop-color="#E4F9DD"/><stop offset="1" stop-color="#FAFBD8"/></linearGradient>
<linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B4E8D6"/><stop offset="1" stop-color="#E3F8DA"/></linearGradient>
<linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FDCC4"/><stop offset="1" stop-color="#D2F2D3"/></linearGradient>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7FD6B2"/><stop offset="1" stop-color="#C8EEC0"/></linearGradient>
<linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FC09A"/><stop offset="1" stop-color="#8FD9A8"/></linearGradient>
<linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F8F7C"/><stop offset="1" stop-color="#14697A"/></linearGradient>
<linearGradient id="g4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F5A62"/><stop offset="1" stop-color="#0A3F4E"/></linearGradient>
<linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6F6C8"/><stop offset="1" stop-color="#E7EDB5"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBD0" stop-opacity=".95"/><stop offset="1" stop-color="#FFFBD0" stop-opacity="0"/></radialGradient>
<clipPath id="ground"><path d="M-40 598 C100 568 250 583 400 598 S700 573 900 588 S1300 573 1640 593 L1640 930 L-40 930Z"/></clipPath>
<filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .3  0 0 0 0 .3  0 0 0 .14 0"/></filter>
</defs><rect width="1600" height="900" fill="url(#sky)"/><circle cx="1050" cy="280" r="260" fill="url(#glow)"/><g transform="translate(120 150) scale(1.3)" opacity="0.85" fill="#fff"><ellipse cx="0" cy="10" rx="80" ry="18"/><ellipse cx="-20" cy="-2" rx="44" ry="22"/><ellipse cx="30" cy="-8" rx="52" ry="26"/></g><g transform="translate(760 110) scale(1.0)" opacity="0.8" fill="#fff"><ellipse cx="0" cy="10" rx="80" ry="18"/><ellipse cx="-20" cy="-2" rx="44" ry="22"/><ellipse cx="30" cy="-8" rx="52" ry="26"/></g><g transform="translate(1250 200) scale(1.2)" opacity="0.7" fill="#fff"><ellipse cx="0" cy="10" rx="80" ry="18"/><ellipse cx="-20" cy="-2" rx="44" ry="22"/><ellipse cx="30" cy="-8" rx="52" ry="26"/></g><g transform="translate(900 330) scale(0.8)" opacity="0.6" fill="#fff"><ellipse cx="0" cy="10" rx="80" ry="18"/><ellipse cx="-20" cy="-2" rx="44" ry="22"/><ellipse cx="30" cy="-8" rx="52" ry="26"/></g><g filter="url(#soft)" opacity=".7"><ellipse cx="800" cy="330" rx="900" ry="20" fill="#fff"/></g><path d="M-40 520 C60 430 150 380 250 410 C340 440 400 480 480 440 C570 395 660 420 760 430 C900 440 1000 380 1150 400 C1300 420 1450 470 1640 500 L1640 640 L-40 640Z" fill="url(#m1)"/><path d="M-40 560 C100 500 220 470 330 505 C430 535 520 520 600 480 C690 440 780 480 900 470 C1050 450 1200 480 1350 500 C1450 515 1550 520 1640 530 L1640 680 L-40 680Z" fill="url(#m2)"/><g filter="url(#soft)" opacity=".75"><ellipse cx="800" cy="585" rx="1000" ry="26" fill="#F4FBDD"/></g><path d="M-40 600 C100 570 250 585 400 600 S700 575 900 590 S1300 575 1640 595 L1640 700 L-40 700Z" fill="url(#g1)"/><polygon points="-7.1,556.6 -15.5,571.6 -7.1,571.6" fill="#7FD3B8"/><polygon points="-7.1,556.6 1.2,571.6 -7.1,571.6" fill="#5FBFA6"/><polygon points="-7.1,564.1 -18.0,579.1 -7.1,579.1" fill="#7FD3B8"/><polygon points="-7.1,564.1 3.8,579.1 -7.1,579.1" fill="#5FBFA6"/><polygon points="-7.1,571.6 -20.6,586.6 -7.1,586.6" fill="#7FD3B8"/><polygon points="-7.1,571.6 6.3,586.6 -7.1,586.6" fill="#5FBFA6"/><polygon points="-7.1,579.1 -23.1,594.1 -7.1,594.1" fill="#7FD3B8"/><polygon points="-7.1,579.1 8.9,594.1 -7.1,594.1" fill="#5FBFA6"/><polygon points="-7.1,586.6 -25.7,601.6 -7.1,601.6" fill="#7FD3B8"/><polygon points="-7.1,586.6 11.4,601.6 -7.1,601.6" fill="#5FBFA6"/><rect x="-8.0" y="599.0" width="1.8" height="3.5" fill="#5FBFA6"/><polygon points="-4.5,556.5 -12.2,570.3 -4.5,570.3" fill="#7FD3B8"/><polygon points="-4.5,556.5 3.2,570.3 -4.5,570.3" fill="#5FBFA6"/><polygon points="-4.5,563.4 -14.5,577.2 -4.5,577.2" fill="#7FD3B8"/><polygon points="-4.5,563.4 5.5,577.2 -4.5,577.2" fill="#5FBFA6"/><polygon points="-4.5,570.3 -16.9,584.1 -4.5,584.1" fill="#7FD3B8"/><polygon points="-4.5,570.3 7.8,584.1 -4.5,584.1" fill="#5FBFA6"/><polygon points="-4.5,577.2 -19.2,591.0 -4.5,591.0" fill="#7FD3B8"/><polygon points="-4.5,577.2 10.2,591.0 -4.5,591.0" fill="#5FBFA6"/><polygon points="-4.5,584.1 -21.6,597.9 -4.5,597.9" fill="#7FD3B8"/><polygon points="-4.5,584.1 12.5,597.9 -4.5,597.9" fill="#5FBFA6"/><rect x="-5.3" y="595.4" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="4.7,553.4 -2.8,566.9 4.7,566.9" fill="#7FD3B8"/><polygon points="4.7,553.4 12.2,566.9 4.7,566.9" fill="#5FBFA6"/><polygon points="4.7,560.2 -5.1,573.7 4.7,573.7" fill="#7FD3B8"/><polygon points="4.7,560.2 14.5,573.7 4.7,573.7" fill="#5FBFA6"/><polygon points="4.7,566.9 -7.4,580.5 4.7,580.5" fill="#7FD3B8"/><polygon points="4.7,566.9 16.8,580.5 4.7,580.5" fill="#5FBFA6"/><polygon points="4.7,573.7 -9.7,587.3 4.7,587.3" fill="#7FD3B8"/><polygon points="4.7,573.7 19.2,587.3 4.7,587.3" fill="#5FBFA6"/><polygon points="4.7,580.5 -12.0,594.0 4.7,594.0" fill="#7FD3B8"/><polygon points="4.7,580.5 21.5,594.0 4.7,594.0" fill="#5FBFA6"/><rect x="3.9" y="591.7" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="11.2,541.1 -0.5,562.2 11.2,562.2" fill="#7FD3B8"/><polygon points="11.2,541.1 22.9,562.2 11.2,562.2" fill="#5FBFA6"/><polygon points="11.2,551.6 -4.0,572.7 11.2,572.7" fill="#7FD3B8"/><polygon points="11.2,551.6 26.5,572.7 11.2,572.7" fill="#5FBFA6"/><polygon points="11.2,562.2 -7.6,583.2 11.2,583.2" fill="#7FD3B8"/><polygon points="11.2,562.2 30.1,583.2 11.2,583.2" fill="#5FBFA6"/><polygon points="11.2,572.7 -11.2,593.7 11.2,593.7" fill="#7FD3B8"/><polygon points="11.2,572.7 33.7,593.7 11.2,593.7" fill="#5FBFA6"/><polygon points="11.2,583.2 -14.8,604.3 11.2,604.3" fill="#7FD3B8"/><polygon points="11.2,583.2 37.2,604.3 11.2,604.3" fill="#5FBFA6"/><rect x="10.0" y="600.6" width="2.5" height="5.0" fill="#5FBFA6"/><polygon points="19.3,557.3 12.2,570.0 19.3,570.0" fill="#7FD3B8"/><polygon points="19.3,557.3 26.3,570.0 19.3,570.0" fill="#5FBFA6"/><polygon points="19.3,563.7 10.1,576.3 19.3,576.3" fill="#7FD3B8"/><polygon points="19.3,563.7 28.5,576.3 19.3,576.3" fill="#5FBFA6"/><polygon points="19.3,570.0 7.9,582.7 19.3,582.7" fill="#7FD3B8"/><polygon points="19.3,570.0 30.6,582.7 19.3,582.7" fill="#5FBFA6"/><polygon points="19.3,576.3 5.8,589.0 19.3,589.0" fill="#7FD3B8"/><polygon points="19.3,576.3 32.8,589.0 19.3,589.0" fill="#5FBFA6"/><polygon points="19.3,582.7 3.6,595.3 19.3,595.3" fill="#7FD3B8"/><polygon points="19.3,582.7 34.9,595.3 19.3,595.3" fill="#5FBFA6"/><rect x="18.5" y="593.1" width="1.5" height="3.0" fill="#5FBFA6"/><polygon points="27.0,557.9 17.6,574.9 27.0,574.9" fill="#7FD3B8"/><polygon points="27.0,557.9 36.5,574.9 27.0,574.9" fill="#5FBFA6"/><polygon points="27.0,566.4 14.7,583.4 27.0,583.4" fill="#7FD3B8"/><polygon points="27.0,566.4 39.3,583.4 27.0,583.4" fill="#5FBFA6"/><polygon points="27.0,574.9 11.9,591.8 27.0,591.8" fill="#7FD3B8"/><polygon points="27.0,574.9 42.2,591.8 27.0,591.8" fill="#5FBFA6"/><polygon points="27.0,583.4 9.0,600.3 27.0,600.3" fill="#7FD3B8"/><polygon points="27.0,583.4 45.1,600.3 27.0,600.3" fill="#5FBFA6"/><polygon points="27.0,591.8 6.1,608.8 27.0,608.8" fill="#7FD3B8"/><polygon points="27.0,591.8 48.0,608.8 27.0,608.8" fill="#5FBFA6"/><rect x="26.0" y="605.8" width="2.0" height="4.0" fill="#5FBFA6"/><polygon points="37.0,556.3 29.0,570.7 37.0,570.7" fill="#7FD3B8"/><polygon points="37.0,556.3 45.0,570.7 37.0,570.7" fill="#5FBFA6"/><polygon points="37.0,563.5 26.6,577.8 37.0,577.8" fill="#7FD3B8"/><polygon points="37.0,563.5 47.4,577.8 37.0,577.8" fill="#5FBFA6"/><polygon points="37.0,570.7 24.1,585.0 37.0,585.0" fill="#7FD3B8"/><polygon points="37.0,570.7 49.8,585.0 37.0,585.0" fill="#5FBFA6"/><polygon points="37.0,577.8 21.7,592.2 37.0,592.2" fill="#7FD3B8"/><polygon points="37.0,577.8 52.3,592.2 37.0,592.2" fill="#5FBFA6"/><polygon points="37.0,585.0 19.3,599.3 37.0,599.3" fill="#7FD3B8"/><polygon points="37.0,585.0 54.7,599.3 37.0,599.3" fill="#5FBFA6"/><rect x="36.1" y="596.8" width="1.7" height="3.4" fill="#5FBFA6"/><polygon points="49.3,544.0 38.5,563.6 49.3,563.6" fill="#7FD3B8"/><polygon points="49.3,544.0 60.2,563.6 49.3,563.6" fill="#5FBFA6"/><polygon points="49.3,553.8 35.2,573.3 49.3,573.3" fill="#7FD3B8"/><polygon points="49.3,553.8 63.5,573.3 49.3,573.3" fill="#5FBFA6"/><polygon points="49.3,563.6 31.8,583.1 49.3,583.1" fill="#7FD3B8"/><polygon points="49.3,563.6 66.8,583.1 49.3,583.1" fill="#5FBFA6"/><polygon points="49.3,573.3 28.5,592.9 49.3,592.9" fill="#7FD3B8"/><polygon points="49.3,573.3 70.2,592.9 49.3,592.9" fill="#5FBFA6"/><polygon points="49.3,583.1 25.2,602.7 49.3,602.7" fill="#7FD3B8"/><polygon points="49.3,583.1 73.5,602.7 49.3,602.7" fill="#5FBFA6"/><rect x="48.2" y="599.2" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="65.7,552.3 56.8,568.3 65.7,568.3" fill="#7FD3B8"/><polygon points="65.7,552.3 74.6,568.3 65.7,568.3" fill="#5FBFA6"/><polygon points="65.7,560.3 54.1,576.3 65.7,576.3" fill="#7FD3B8"/><polygon points="65.7,560.3 77.3,576.3 65.7,576.3" fill="#5FBFA6"/><polygon points="65.7,568.3 51.4,584.3 65.7,584.3" fill="#7FD3B8"/><polygon points="65.7,568.3 80.0,584.3 65.7,584.3" fill="#5FBFA6"/><polygon points="65.7,576.3 48.7,592.2 65.7,592.2" fill="#7FD3B8"/><polygon points="65.7,576.3 82.7,592.2 65.7,592.2" fill="#5FBFA6"/><polygon points="65.7,584.3 46.0,600.2 65.7,600.2" fill="#7FD3B8"/><polygon points="65.7,584.3 85.4,600.2 65.7,600.2" fill="#5FBFA6"/><rect x="64.8" y="597.4" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="82.3,533.1 71.0,553.4 82.3,553.4" fill="#7FD3B8"/><polygon points="82.3,533.1 93.6,553.4 82.3,553.4" fill="#5FBFA6"/><polygon points="82.3,543.2 67.6,563.6 82.3,563.6" fill="#7FD3B8"/><polygon points="82.3,543.2 97.1,563.6 82.3,563.6" fill="#5FBFA6"/><polygon points="82.3,553.4 64.1,573.7 82.3,573.7" fill="#7FD3B8"/><polygon points="82.3,553.4 100.6,573.7 82.3,573.7" fill="#5FBFA6"/><polygon points="82.3,563.6 60.7,583.9 82.3,583.9" fill="#7FD3B8"/><polygon points="82.3,563.6 104.0,583.9 82.3,583.9" fill="#5FBFA6"/><polygon points="82.3,573.7 57.2,594.1 82.3,594.1" fill="#7FD3B8"/><polygon points="82.3,573.7 107.5,594.1 82.3,594.1" fill="#5FBFA6"/><rect x="81.1" y="590.5" width="2.4" height="4.8" fill="#5FBFA6"/><polygon points="95.5,543.7 86.3,560.3 95.5,560.3" fill="#7FD3B8"/><polygon points="95.5,543.7 104.8,560.3 95.5,560.3" fill="#5FBFA6"/><polygon points="95.5,552.0 83.5,568.6 95.5,568.6" fill="#7FD3B8"/><polygon points="95.5,552.0 107.6,568.6 95.5,568.6" fill="#5FBFA6"/><polygon points="95.5,560.3 80.7,576.9 95.5,576.9" fill="#7FD3B8"/><polygon points="95.5,560.3 110.4,576.9 95.5,576.9" fill="#5FBFA6"/><polygon points="95.5,568.6 77.8,585.2 95.5,585.2" fill="#7FD3B8"/><polygon points="95.5,568.6 113.2,585.2 95.5,585.2" fill="#5FBFA6"/><polygon points="95.5,576.9 75.0,593.5 95.5,593.5" fill="#7FD3B8"/><polygon points="95.5,576.9 116.0,593.5 95.5,593.5" fill="#5FBFA6"/><rect x="94.5" y="590.6" width="2.0" height="3.9" fill="#5FBFA6"/><polygon points="137.7,566.0 130.3,579.4 137.7,579.4" fill="#7FD3B8"/><polygon points="137.7,566.0 145.2,579.4 137.7,579.4" fill="#5FBFA6"/><polygon points="137.7,572.7 128.0,586.1 137.7,586.1" fill="#7FD3B8"/><polygon points="137.7,572.7 147.4,586.1 137.7,586.1" fill="#5FBFA6"/><polygon points="137.7,579.4 125.7,592.8 137.7,592.8" fill="#7FD3B8"/><polygon points="137.7,579.4 149.7,592.8 137.7,592.8" fill="#5FBFA6"/><polygon points="137.7,586.1 123.4,599.5 137.7,599.5" fill="#7FD3B8"/><polygon points="137.7,586.1 152.0,599.5 137.7,599.5" fill="#5FBFA6"/><polygon points="137.7,592.8 121.2,606.2 137.7,606.2" fill="#7FD3B8"/><polygon points="137.7,592.8 154.3,606.2 137.7,606.2" fill="#5FBFA6"/><rect x="136.9" y="603.8" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="165.0,543.0 153.6,563.6 165.0,563.6" fill="#7FD3B8"/><polygon points="165.0,543.0 176.5,563.6 165.0,563.6" fill="#5FBFA6"/><polygon points="165.0,553.3 150.1,574.0 165.0,574.0" fill="#7FD3B8"/><polygon points="165.0,553.3 180.0,574.0 165.0,574.0" fill="#5FBFA6"/><polygon points="165.0,563.6 146.6,584.3 165.0,584.3" fill="#7FD3B8"/><polygon points="165.0,563.6 183.5,584.3 165.0,584.3" fill="#5FBFA6"/><polygon points="165.0,574.0 143.1,594.6 165.0,594.6" fill="#7FD3B8"/><polygon points="165.0,574.0 187.0,594.6 165.0,594.6" fill="#5FBFA6"/><polygon points="165.0,584.3 139.6,604.9 165.0,604.9" fill="#7FD3B8"/><polygon points="165.0,584.3 190.5,604.9 165.0,604.9" fill="#5FBFA6"/><rect x="163.8" y="601.3" width="2.4" height="4.9" fill="#5FBFA6"/><polygon points="173.4,545.6 162.7,564.8 173.4,564.8" fill="#7FD3B8"/><polygon points="173.4,545.6 184.1,564.8 173.4,564.8" fill="#5FBFA6"/><polygon points="173.4,555.2 159.5,574.4 173.4,574.4" fill="#7FD3B8"/><polygon points="173.4,555.2 187.3,574.4 173.4,574.4" fill="#5FBFA6"/><polygon points="173.4,564.8 156.2,584.0 173.4,584.0" fill="#7FD3B8"/><polygon points="173.4,564.8 190.6,584.0 173.4,584.0" fill="#5FBFA6"/><polygon points="173.4,574.4 152.9,593.6 173.4,593.6" fill="#7FD3B8"/><polygon points="173.4,574.4 193.9,593.6 173.4,593.6" fill="#5FBFA6"/><polygon points="173.4,584.0 149.7,603.2 173.4,603.2" fill="#7FD3B8"/><polygon points="173.4,584.0 197.1,603.2 173.4,603.2" fill="#5FBFA6"/><rect x="172.3" y="599.8" width="2.3" height="4.5" fill="#5FBFA6"/><polygon points="195.3,546.4 186.3,562.5 195.3,562.5" fill="#7FD3B8"/><polygon points="195.3,546.4 204.2,562.5 195.3,562.5" fill="#5FBFA6"/><polygon points="195.3,554.4 183.6,570.5 195.3,570.5" fill="#7FD3B8"/><polygon points="195.3,554.4 206.9,570.5 195.3,570.5" fill="#5FBFA6"/><polygon points="195.3,562.5 180.9,578.6 195.3,578.6" fill="#7FD3B8"/><polygon points="195.3,562.5 209.7,578.6 195.3,578.6" fill="#5FBFA6"/><polygon points="195.3,570.5 178.1,586.6 195.3,586.6" fill="#7FD3B8"/><polygon points="195.3,570.5 212.4,586.6 195.3,586.6" fill="#5FBFA6"/><polygon points="195.3,578.6 175.4,594.7 195.3,594.7" fill="#7FD3B8"/><polygon points="195.3,578.6 215.1,594.7 195.3,594.7" fill="#5FBFA6"/><rect x="194.3" y="591.8" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="214.8,536.4 203.8,556.1 214.8,556.1" fill="#7FD3B8"/><polygon points="214.8,536.4 225.8,556.1 214.8,556.1" fill="#5FBFA6"/><polygon points="214.8,546.3 200.5,566.0 214.8,566.0" fill="#7FD3B8"/><polygon points="214.8,546.3 229.1,566.0 214.8,566.0" fill="#5FBFA6"/><polygon points="214.8,556.1 197.2,575.8 214.8,575.8" fill="#7FD3B8"/><polygon points="214.8,556.1 232.5,575.8 214.8,575.8" fill="#5FBFA6"/><polygon points="214.8,566.0 193.8,585.7 214.8,585.7" fill="#7FD3B8"/><polygon points="214.8,566.0 235.8,585.7 214.8,585.7" fill="#5FBFA6"/><polygon points="214.8,575.8 190.5,595.5 214.8,595.5" fill="#7FD3B8"/><polygon points="214.8,575.8 239.1,595.5 214.8,595.5" fill="#5FBFA6"/><rect x="213.6" y="592.1" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="226.0,548.9 217.0,565.2 226.0,565.2" fill="#7FD3B8"/><polygon points="226.0,548.9 235.1,565.2 226.0,565.2" fill="#5FBFA6"/><polygon points="226.0,557.1 214.2,573.3 226.0,573.3" fill="#7FD3B8"/><polygon points="226.0,557.1 237.8,573.3 226.0,573.3" fill="#5FBFA6"/><polygon points="226.0,565.2 211.5,581.4 226.0,581.4" fill="#7FD3B8"/><polygon points="226.0,565.2 240.6,581.4 226.0,581.4" fill="#5FBFA6"/><polygon points="226.0,573.3 208.7,589.5 226.0,589.5" fill="#7FD3B8"/><polygon points="226.0,573.3 243.3,589.5 226.0,589.5" fill="#5FBFA6"/><polygon points="226.0,581.4 206.0,597.7 226.0,597.7" fill="#7FD3B8"/><polygon points="226.0,581.4 246.1,597.7 226.0,597.7" fill="#5FBFA6"/><rect x="225.1" y="594.8" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="248.6,549.8 237.6,569.6 248.6,569.6" fill="#7FD3B8"/><polygon points="248.6,549.8 259.6,569.6 248.6,569.6" fill="#5FBFA6"/><polygon points="248.6,559.7 234.2,579.5 248.6,579.5" fill="#7FD3B8"/><polygon points="248.6,559.7 262.9,579.5 248.6,579.5" fill="#5FBFA6"/><polygon points="248.6,569.6 230.8,589.4 248.6,589.4" fill="#7FD3B8"/><polygon points="248.6,569.6 266.3,589.4 248.6,589.4" fill="#5FBFA6"/><polygon points="248.6,579.5 227.5,599.3 248.6,599.3" fill="#7FD3B8"/><polygon points="248.6,579.5 269.6,599.3 248.6,599.3" fill="#5FBFA6"/><polygon points="248.6,589.4 224.1,609.2 248.6,609.2" fill="#7FD3B8"/><polygon points="248.6,589.4 273.0,609.2 248.6,609.2" fill="#5FBFA6"/><rect x="247.4" y="605.7" width="2.3" height="4.7" fill="#5FBFA6"/><polygon points="258.8,559.8 249.8,576.1 258.8,576.1" fill="#7FD3B8"/><polygon points="258.8,559.8 267.9,576.1 258.8,576.1" fill="#5FBFA6"/><polygon points="258.8,567.9 247.1,584.2 258.8,584.2" fill="#7FD3B8"/><polygon points="258.8,567.9 270.6,584.2 258.8,584.2" fill="#5FBFA6"/><polygon points="258.8,576.1 244.3,592.3 258.8,592.3" fill="#7FD3B8"/><polygon points="258.8,576.1 273.4,592.3 258.8,592.3" fill="#5FBFA6"/><polygon points="258.8,584.2 241.5,600.4 258.8,600.4" fill="#7FD3B8"/><polygon points="258.8,584.2 276.2,600.4 258.8,600.4" fill="#5FBFA6"/><polygon points="258.8,592.3 238.8,608.6 258.8,608.6" fill="#7FD3B8"/><polygon points="258.8,592.3 278.9,608.6 258.8,608.6" fill="#5FBFA6"/><rect x="257.9" y="605.7" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="283.1,544.8 272.7,563.5 283.1,563.5" fill="#7FD3B8"/><polygon points="283.1,544.8 293.5,563.5 283.1,563.5" fill="#5FBFA6"/><polygon points="283.1,554.2 269.5,572.9 283.1,572.9" fill="#7FD3B8"/><polygon points="283.1,554.2 296.7,572.9 283.1,572.9" fill="#5FBFA6"/><polygon points="283.1,563.5 266.4,582.2 283.1,582.2" fill="#7FD3B8"/><polygon points="283.1,563.5 299.8,582.2 283.1,582.2" fill="#5FBFA6"/><polygon points="283.1,572.9 263.2,591.6 283.1,591.6" fill="#7FD3B8"/><polygon points="283.1,572.9 303.0,591.6 283.1,591.6" fill="#5FBFA6"/><polygon points="283.1,582.2 260.0,600.9 283.1,600.9" fill="#7FD3B8"/><polygon points="283.1,582.2 306.2,600.9 283.1,600.9" fill="#5FBFA6"/><rect x="282.0" y="597.6" width="2.2" height="4.4" fill="#5FBFA6"/><polygon points="308.4,556.1 300.1,570.9 308.4,570.9" fill="#7FD3B8"/><polygon points="308.4,556.1 316.6,570.9 308.4,570.9" fill="#5FBFA6"/><polygon points="308.4,563.5 297.6,578.3 308.4,578.3" fill="#7FD3B8"/><polygon points="308.4,563.5 319.1,578.3 308.4,578.3" fill="#5FBFA6"/><polygon points="308.4,570.9 295.1,585.7 308.4,585.7" fill="#7FD3B8"/><polygon points="308.4,570.9 321.6,585.7 308.4,585.7" fill="#5FBFA6"/><polygon points="308.4,578.3 292.6,593.1 308.4,593.1" fill="#7FD3B8"/><polygon points="308.4,578.3 324.1,593.1 308.4,593.1" fill="#5FBFA6"/><polygon points="308.4,585.7 290.1,600.5 308.4,600.5" fill="#7FD3B8"/><polygon points="308.4,585.7 326.7,600.5 308.4,600.5" fill="#5FBFA6"/><rect x="307.5" y="597.9" width="1.7" height="3.5" fill="#5FBFA6"/><polygon points="321.7,558.7 314.2,572.2 321.7,572.2" fill="#7FD3B8"/><polygon points="321.7,558.7 329.3,572.2 321.7,572.2" fill="#5FBFA6"/><polygon points="321.7,565.4 311.9,579.0 321.7,579.0" fill="#7FD3B8"/><polygon points="321.7,565.4 331.6,579.0 321.7,579.0" fill="#5FBFA6"/><polygon points="321.7,572.2 309.6,585.7 321.7,585.7" fill="#7FD3B8"/><polygon points="321.7,572.2 333.9,585.7 321.7,585.7" fill="#5FBFA6"/><polygon points="321.7,579.0 307.3,592.5 321.7,592.5" fill="#7FD3B8"/><polygon points="321.7,579.0 336.2,592.5 321.7,592.5" fill="#5FBFA6"/><polygon points="321.7,585.7 305.0,599.3 321.7,599.3" fill="#7FD3B8"/><polygon points="321.7,585.7 338.5,599.3 321.7,599.3" fill="#5FBFA6"/><rect x="320.9" y="596.9" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="329.3,536.3 317.7,557.3 329.3,557.3" fill="#7FD3B8"/><polygon points="329.3,536.3 341.0,557.3 329.3,557.3" fill="#5FBFA6"/><polygon points="329.3,546.8 314.1,567.8 329.3,567.8" fill="#7FD3B8"/><polygon points="329.3,546.8 344.5,567.8 329.3,567.8" fill="#5FBFA6"/><polygon points="329.3,557.3 310.5,578.3 329.3,578.3" fill="#7FD3B8"/><polygon points="329.3,557.3 348.1,578.3 329.3,578.3" fill="#5FBFA6"/><polygon points="329.3,567.8 307.0,588.8 329.3,588.8" fill="#7FD3B8"/><polygon points="329.3,567.8 351.7,588.8 329.3,588.8" fill="#5FBFA6"/><polygon points="329.3,578.3 303.4,599.3 329.3,599.3" fill="#7FD3B8"/><polygon points="329.3,578.3 355.2,599.3 329.3,599.3" fill="#5FBFA6"/><rect x="328.1" y="595.6" width="2.5" height="4.9" fill="#5FBFA6"/><polygon points="339.1,555.1 329.2,572.8 339.1,572.8" fill="#7FD3B8"/><polygon points="339.1,555.1 349.0,572.8 339.1,572.8" fill="#5FBFA6"/><polygon points="339.1,563.9 326.2,581.7 339.1,581.7" fill="#7FD3B8"/><polygon points="339.1,563.9 352.0,581.7 339.1,581.7" fill="#5FBFA6"/><polygon points="339.1,572.8 323.2,590.6 339.1,590.6" fill="#7FD3B8"/><polygon points="339.1,572.8 355.0,590.6 339.1,590.6" fill="#5FBFA6"/><polygon points="339.1,581.7 320.1,599.5 339.1,599.5" fill="#7FD3B8"/><polygon points="339.1,581.7 358.0,599.5 339.1,599.5" fill="#5FBFA6"/><polygon points="339.1,590.6 317.1,608.4 339.1,608.4" fill="#7FD3B8"/><polygon points="339.1,590.6 361.0,608.4 339.1,608.4" fill="#5FBFA6"/><rect x="338.0" y="605.3" width="2.1" height="4.2" fill="#5FBFA6"/><polygon points="341.1,555.2 332.6,570.4 341.1,570.4" fill="#7FD3B8"/><polygon points="341.1,555.2 349.6,570.4 341.1,570.4" fill="#5FBFA6"/><polygon points="341.1,562.8 330.0,578.0 341.1,578.0" fill="#7FD3B8"/><polygon points="341.1,562.8 352.2,578.0 341.1,578.0" fill="#5FBFA6"/><polygon points="341.1,570.4 327.5,585.7 341.1,585.7" fill="#7FD3B8"/><polygon points="341.1,570.4 354.7,585.7 341.1,585.7" fill="#5FBFA6"/><polygon points="341.1,578.0 324.9,593.3 341.1,593.3" fill="#7FD3B8"/><polygon points="341.1,578.0 357.3,593.3 341.1,593.3" fill="#5FBFA6"/><polygon points="341.1,585.7 322.3,600.9 341.1,600.9" fill="#7FD3B8"/><polygon points="341.1,585.7 359.9,600.9 341.1,600.9" fill="#5FBFA6"/><rect x="340.2" y="598.2" width="1.8" height="3.6" fill="#5FBFA6"/><polygon points="389.4,550.3 381.3,565.0 389.4,565.0" fill="#7FD3B8"/><polygon points="389.4,550.3 397.6,565.0 389.4,565.0" fill="#5FBFA6"/><polygon points="389.4,557.7 378.8,572.3 389.4,572.3" fill="#7FD3B8"/><polygon points="389.4,557.7 400.1,572.3 389.4,572.3" fill="#5FBFA6"/><polygon points="389.4,565.0 376.3,579.6 389.4,579.6" fill="#7FD3B8"/><polygon points="389.4,565.0 402.6,579.6 389.4,579.6" fill="#5FBFA6"/><polygon points="389.4,572.3 373.8,587.0 389.4,587.0" fill="#7FD3B8"/><polygon points="389.4,572.3 405.1,587.0 389.4,587.0" fill="#5FBFA6"/><polygon points="389.4,579.6 371.4,594.3 389.4,594.3" fill="#7FD3B8"/><polygon points="389.4,579.6 407.5,594.3 389.4,594.3" fill="#5FBFA6"/><rect x="388.6" y="591.7" width="1.7" height="3.4" fill="#5FBFA6"/><polygon points="442.8,546.0 431.7,565.9 442.8,565.9" fill="#7FD3B8"/><polygon points="442.8,546.0 453.8,565.9 442.8,565.9" fill="#5FBFA6"/><polygon points="442.8,555.9 428.3,575.8 442.8,575.8" fill="#7FD3B8"/><polygon points="442.8,555.9 457.2,575.8 442.8,575.8" fill="#5FBFA6"/><polygon points="442.8,565.9 424.9,585.8 442.8,585.8" fill="#7FD3B8"/><polygon points="442.8,565.9 460.6,585.8 442.8,585.8" fill="#5FBFA6"/><polygon points="442.8,575.8 421.6,595.7 442.8,595.7" fill="#7FD3B8"/><polygon points="442.8,575.8 464.0,595.7 442.8,595.7" fill="#5FBFA6"/><polygon points="442.8,585.8 418.2,605.7 442.8,605.7" fill="#7FD3B8"/><polygon points="442.8,585.8 467.4,605.7 442.8,605.7" fill="#5FBFA6"/><rect x="441.6" y="602.2" width="2.3" height="4.7" fill="#5FBFA6"/><polygon points="458.7,541.3 448.0,560.5 458.7,560.5" fill="#7FD3B8"/><polygon points="458.7,541.3 469.3,560.5 458.7,560.5" fill="#5FBFA6"/><polygon points="458.7,550.9 444.7,570.1 458.7,570.1" fill="#7FD3B8"/><polygon points="458.7,550.9 472.6,570.1 458.7,570.1" fill="#5FBFA6"/><polygon points="458.7,560.5 441.5,579.7 458.7,579.7" fill="#7FD3B8"/><polygon points="458.7,560.5 475.9,579.7 458.7,579.7" fill="#5FBFA6"/><polygon points="458.7,570.1 438.2,589.3 458.7,589.3" fill="#7FD3B8"/><polygon points="458.7,570.1 479.1,589.3 458.7,589.3" fill="#5FBFA6"/><polygon points="458.7,579.7 435.0,598.9 458.7,598.9" fill="#7FD3B8"/><polygon points="458.7,579.7 482.4,598.9 458.7,598.9" fill="#5FBFA6"/><rect x="457.5" y="595.5" width="2.3" height="4.5" fill="#5FBFA6"/><polygon points="474.0,550.3 463.8,568.7 474.0,568.7" fill="#7FD3B8"/><polygon points="474.0,550.3 484.3,568.7 474.0,568.7" fill="#5FBFA6"/><polygon points="474.0,559.5 460.7,577.9 474.0,577.9" fill="#7FD3B8"/><polygon points="474.0,559.5 487.4,577.9 474.0,577.9" fill="#5FBFA6"/><polygon points="474.0,568.7 457.6,587.1 474.0,587.1" fill="#7FD3B8"/><polygon points="474.0,568.7 490.5,587.1 474.0,587.1" fill="#5FBFA6"/><polygon points="474.0,577.9 454.5,596.3 474.0,596.3" fill="#7FD3B8"/><polygon points="474.0,577.9 493.6,596.3 474.0,596.3" fill="#5FBFA6"/><polygon points="474.0,587.1 451.3,605.5 474.0,605.5" fill="#7FD3B8"/><polygon points="474.0,587.1 496.7,605.5 474.0,605.5" fill="#5FBFA6"/><rect x="473.0" y="602.2" width="2.2" height="4.3" fill="#5FBFA6"/><polygon points="478.2,546.9 467.7,565.8 478.2,565.8" fill="#7FD3B8"/><polygon points="478.2,546.9 488.7,565.8 478.2,565.8" fill="#5FBFA6"/><polygon points="478.2,556.4 464.4,575.3 478.2,575.3" fill="#7FD3B8"/><polygon points="478.2,556.4 492.0,575.3 478.2,575.3" fill="#5FBFA6"/><polygon points="478.2,565.8 461.2,584.8 478.2,584.8" fill="#7FD3B8"/><polygon points="478.2,565.8 495.2,584.8 478.2,584.8" fill="#5FBFA6"/><polygon points="478.2,575.3 458.0,594.3 478.2,594.3" fill="#7FD3B8"/><polygon points="478.2,575.3 498.4,594.3 478.2,594.3" fill="#5FBFA6"/><polygon points="478.2,584.8 454.8,603.7 478.2,603.7" fill="#7FD3B8"/><polygon points="478.2,584.8 501.6,603.7 478.2,603.7" fill="#5FBFA6"/><rect x="477.1" y="600.4" width="2.2" height="4.5" fill="#5FBFA6"/><polygon points="492.1,543.5 481.9,562.0 492.1,562.0" fill="#7FD3B8"/><polygon points="492.1,543.5 502.4,562.0 492.1,562.0" fill="#5FBFA6"/><polygon points="492.1,552.7 478.7,571.2 492.1,571.2" fill="#7FD3B8"/><polygon points="492.1,552.7 505.5,571.2 492.1,571.2" fill="#5FBFA6"/><polygon points="492.1,562.0 475.6,580.4 492.1,580.4" fill="#7FD3B8"/><polygon points="492.1,562.0 508.7,580.4 492.1,580.4" fill="#5FBFA6"/><polygon points="492.1,571.2 472.5,589.7 492.1,589.7" fill="#7FD3B8"/><polygon points="492.1,571.2 511.8,589.7 492.1,589.7" fill="#5FBFA6"/><polygon points="492.1,580.4 469.3,598.9 492.1,598.9" fill="#7FD3B8"/><polygon points="492.1,580.4 514.9,598.9 492.1,598.9" fill="#5FBFA6"/><rect x="491.0" y="595.6" width="2.2" height="4.3" fill="#5FBFA6"/><polygon points="501.6,547.9 492.4,564.4 501.6,564.4" fill="#7FD3B8"/><polygon points="501.6,547.9 510.8,564.4 501.6,564.4" fill="#5FBFA6"/><polygon points="501.6,556.1 489.6,572.7 501.6,572.7" fill="#7FD3B8"/><polygon points="501.6,556.1 513.6,572.7 501.6,572.7" fill="#5FBFA6"/><polygon points="501.6,564.4 486.8,580.9 501.6,580.9" fill="#7FD3B8"/><polygon points="501.6,564.4 516.4,580.9 501.6,580.9" fill="#5FBFA6"/><polygon points="501.6,572.7 484.0,589.2 501.6,589.2" fill="#7FD3B8"/><polygon points="501.6,572.7 519.2,589.2 501.6,589.2" fill="#5FBFA6"/><polygon points="501.6,580.9 481.2,597.5 501.6,597.5" fill="#7FD3B8"/><polygon points="501.6,580.9 522.0,597.5 501.6,597.5" fill="#5FBFA6"/><rect x="500.6" y="594.5" width="1.9" height="3.9" fill="#5FBFA6"/><polygon points="744.3,550.4 734.1,568.7 744.3,568.7" fill="#7FD3B8"/><polygon points="744.3,550.4 754.5,568.7 744.3,568.7" fill="#5FBFA6"/><polygon points="744.3,559.5 731.0,577.9 744.3,577.9" fill="#7FD3B8"/><polygon points="744.3,559.5 757.6,577.9 744.3,577.9" fill="#5FBFA6"/><polygon points="744.3,568.7 727.9,587.0 744.3,587.0" fill="#7FD3B8"/><polygon points="744.3,568.7 760.7,587.0 744.3,587.0" fill="#5FBFA6"/><polygon points="744.3,577.9 724.8,596.2 744.3,596.2" fill="#7FD3B8"/><polygon points="744.3,577.9 763.9,596.2 744.3,596.2" fill="#5FBFA6"/><polygon points="744.3,587.0 721.6,605.4 744.3,605.4" fill="#7FD3B8"/><polygon points="744.3,587.0 767.0,605.4 744.3,605.4" fill="#5FBFA6"/><rect x="743.2" y="602.2" width="2.2" height="4.3" fill="#5FBFA6"/><polygon points="749.9,536.1 738.4,556.7 749.9,556.7" fill="#7FD3B8"/><polygon points="749.9,536.1 761.3,556.7 749.9,556.7" fill="#5FBFA6"/><polygon points="749.9,546.4 734.9,567.0 749.9,567.0" fill="#7FD3B8"/><polygon points="749.9,546.4 764.8,567.0 749.9,567.0" fill="#5FBFA6"/><polygon points="749.9,556.7 731.4,577.3 749.9,577.3" fill="#7FD3B8"/><polygon points="749.9,556.7 768.3,577.3 749.9,577.3" fill="#5FBFA6"/><polygon points="749.9,567.0 727.9,587.6 749.9,587.6" fill="#7FD3B8"/><polygon points="749.9,567.0 771.8,587.6 749.9,587.6" fill="#5FBFA6"/><polygon points="749.9,577.3 724.4,597.9 749.9,597.9" fill="#7FD3B8"/><polygon points="749.9,577.3 775.3,597.9 749.9,597.9" fill="#5FBFA6"/><rect x="748.7" y="594.3" width="2.4" height="4.8" fill="#5FBFA6"/><polygon points="768.8,551.3 759.1,568.7 768.8,568.7" fill="#7FD3B8"/><polygon points="768.8,551.3 778.5,568.7 768.8,568.7" fill="#5FBFA6"/><polygon points="768.8,560.0 756.2,577.4 768.8,577.4" fill="#7FD3B8"/><polygon points="768.8,560.0 781.4,577.4 768.8,577.4" fill="#5FBFA6"/><polygon points="768.8,568.7 753.2,586.0 768.8,586.0" fill="#7FD3B8"/><polygon points="768.8,568.7 784.4,586.0 768.8,586.0" fill="#5FBFA6"/><polygon points="768.8,577.4 750.3,594.7 768.8,594.7" fill="#7FD3B8"/><polygon points="768.8,577.4 787.3,594.7 768.8,594.7" fill="#5FBFA6"/><polygon points="768.8,586.0 747.3,603.4 768.8,603.4" fill="#7FD3B8"/><polygon points="768.8,586.0 790.3,603.4 768.8,603.4" fill="#5FBFA6"/><rect x="767.8" y="600.4" width="2.0" height="4.1" fill="#5FBFA6"/><polygon points="769.6,542.0 760.1,559.0 769.6,559.0" fill="#7FD3B8"/><polygon points="769.6,542.0 779.1,559.0 769.6,559.0" fill="#5FBFA6"/><polygon points="769.6,550.5 757.2,567.6 769.6,567.6" fill="#7FD3B8"/><polygon points="769.6,550.5 782.0,567.6 769.6,567.6" fill="#5FBFA6"/><polygon points="769.6,559.0 754.3,576.1 769.6,576.1" fill="#7FD3B8"/><polygon points="769.6,559.0 784.9,576.1 769.6,576.1" fill="#5FBFA6"/><polygon points="769.6,567.6 751.4,584.7 769.6,584.7" fill="#7FD3B8"/><polygon points="769.6,567.6 787.8,584.7 769.6,584.7" fill="#5FBFA6"/><polygon points="769.6,576.1 748.5,593.2 769.6,593.2" fill="#7FD3B8"/><polygon points="769.6,576.1 790.7,593.2 769.6,593.2" fill="#5FBFA6"/><rect x="768.6" y="590.2" width="2.0" height="4.0" fill="#5FBFA6"/><polygon points="840.0,542.5 829.9,560.7 840.0,560.7" fill="#7FD3B8"/><polygon points="840.0,542.5 850.1,560.7 840.0,560.7" fill="#5FBFA6"/><polygon points="840.0,551.6 826.8,569.8 840.0,569.8" fill="#7FD3B8"/><polygon points="840.0,551.6 853.2,569.8 840.0,569.8" fill="#5FBFA6"/><polygon points="840.0,560.7 823.7,578.9 840.0,578.9" fill="#7FD3B8"/><polygon points="840.0,560.7 856.3,578.9 840.0,578.9" fill="#5FBFA6"/><polygon points="840.0,569.8 820.7,588.0 840.0,588.0" fill="#7FD3B8"/><polygon points="840.0,569.8 859.4,588.0 840.0,588.0" fill="#5FBFA6"/><polygon points="840.0,578.9 817.6,597.1 840.0,597.1" fill="#7FD3B8"/><polygon points="840.0,578.9 862.5,597.1 840.0,597.1" fill="#5FBFA6"/><rect x="838.9" y="593.9" width="2.1" height="4.3" fill="#5FBFA6"/><polygon points="863.5,542.2 852.7,561.6 863.5,561.6" fill="#7FD3B8"/><polygon points="863.5,542.2 874.4,561.6 863.5,561.6" fill="#5FBFA6"/><polygon points="863.5,551.9 849.4,571.4 863.5,571.4" fill="#7FD3B8"/><polygon points="863.5,551.9 877.7,571.4 863.5,571.4" fill="#5FBFA6"/><polygon points="863.5,561.6 846.1,581.1 863.5,581.1" fill="#7FD3B8"/><polygon points="863.5,561.6 881.0,581.1 863.5,581.1" fill="#5FBFA6"/><polygon points="863.5,571.4 842.8,590.8 863.5,590.8" fill="#7FD3B8"/><polygon points="863.5,571.4 884.3,590.8 863.5,590.8" fill="#5FBFA6"/><polygon points="863.5,581.1 839.5,600.6 863.5,600.6" fill="#7FD3B8"/><polygon points="863.5,581.1 887.6,600.6 863.5,600.6" fill="#5FBFA6"/><rect x="862.4" y="597.1" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="870.9,545.6 860.2,564.9 870.9,564.9" fill="#7FD3B8"/><polygon points="870.9,545.6 881.6,564.9 870.9,564.9" fill="#5FBFA6"/><polygon points="870.9,555.3 856.9,574.6 870.9,574.6" fill="#7FD3B8"/><polygon points="870.9,555.3 884.9,574.6 870.9,574.6" fill="#5FBFA6"/><polygon points="870.9,564.9 853.6,584.2 870.9,584.2" fill="#7FD3B8"/><polygon points="870.9,564.9 888.2,584.2 870.9,584.2" fill="#5FBFA6"/><polygon points="870.9,574.6 850.3,593.8 870.9,593.8" fill="#7FD3B8"/><polygon points="870.9,574.6 891.4,593.8 870.9,593.8" fill="#5FBFA6"/><polygon points="870.9,584.2 847.1,603.5 870.9,603.5" fill="#7FD3B8"/><polygon points="870.9,584.2 894.7,603.5 870.9,603.5" fill="#5FBFA6"/><rect x="869.8" y="600.1" width="2.3" height="4.5" fill="#5FBFA6"/><polygon points="919.8,544.8 909.8,562.8 919.8,562.8" fill="#7FD3B8"/><polygon points="919.8,544.8 929.8,562.8 919.8,562.8" fill="#5FBFA6"/><polygon points="919.8,553.8 906.8,571.7 919.8,571.7" fill="#7FD3B8"/><polygon points="919.8,553.8 932.8,571.7 919.8,571.7" fill="#5FBFA6"/><polygon points="919.8,562.8 903.7,580.7 919.8,580.7" fill="#7FD3B8"/><polygon points="919.8,562.8 935.8,580.7 919.8,580.7" fill="#5FBFA6"/><polygon points="919.8,571.7 900.7,589.7 919.8,589.7" fill="#7FD3B8"/><polygon points="919.8,571.7 938.9,589.7 919.8,589.7" fill="#5FBFA6"/><polygon points="919.8,580.7 897.6,598.6 919.8,598.6" fill="#7FD3B8"/><polygon points="919.8,580.7 941.9,598.6 919.8,598.6" fill="#5FBFA6"/><rect x="918.7" y="595.5" width="2.1" height="4.2" fill="#5FBFA6"/><polygon points="927.2,546.3 916.3,565.8 927.2,565.8" fill="#7FD3B8"/><polygon points="927.2,546.3 938.1,565.8 927.2,565.8" fill="#5FBFA6"/><polygon points="927.2,556.1 913.0,575.6 927.2,575.6" fill="#7FD3B8"/><polygon points="927.2,556.1 941.4,575.6 927.2,575.6" fill="#5FBFA6"/><polygon points="927.2,565.8 909.7,585.4 927.2,585.4" fill="#7FD3B8"/><polygon points="927.2,565.8 944.7,585.4 927.2,585.4" fill="#5FBFA6"/><polygon points="927.2,575.6 906.4,595.2 927.2,595.2" fill="#7FD3B8"/><polygon points="927.2,575.6 948.0,595.2 927.2,595.2" fill="#5FBFA6"/><polygon points="927.2,585.4 903.0,605.0 927.2,605.0" fill="#7FD3B8"/><polygon points="927.2,585.4 951.4,605.0 927.2,605.0" fill="#5FBFA6"/><rect x="926.0" y="601.5" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="967.0,539.7 956.1,559.4 967.0,559.4" fill="#7FD3B8"/><polygon points="967.0,539.7 978.0,559.4 967.0,559.4" fill="#5FBFA6"/><polygon points="967.0,549.5 952.7,569.2 967.0,569.2" fill="#7FD3B8"/><polygon points="967.0,549.5 981.3,569.2 967.0,569.2" fill="#5FBFA6"/><polygon points="967.0,559.4 949.4,579.1 967.0,579.1" fill="#7FD3B8"/><polygon points="967.0,559.4 984.7,579.1 967.0,579.1" fill="#5FBFA6"/><polygon points="967.0,569.2 946.1,588.9 967.0,588.9" fill="#7FD3B8"/><polygon points="967.0,569.2 988.0,588.9 967.0,588.9" fill="#5FBFA6"/><polygon points="967.0,579.1 942.7,598.8 967.0,598.8" fill="#7FD3B8"/><polygon points="967.0,579.1 991.4,598.8 967.0,598.8" fill="#5FBFA6"/><rect x="965.9" y="595.3" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="979.5,552.0 969.4,570.3 979.5,570.3" fill="#7FD3B8"/><polygon points="979.5,552.0 989.7,570.3 979.5,570.3" fill="#5FBFA6"/><polygon points="979.5,561.2 966.2,579.5 979.5,579.5" fill="#7FD3B8"/><polygon points="979.5,561.2 992.8,579.5 979.5,579.5" fill="#5FBFA6"/><polygon points="979.5,570.3 963.1,588.7 979.5,588.7" fill="#7FD3B8"/><polygon points="979.5,570.3 996.0,588.7 979.5,588.7" fill="#5FBFA6"/><polygon points="979.5,579.5 960.0,597.8 979.5,597.8" fill="#7FD3B8"/><polygon points="979.5,579.5 999.1,597.8 979.5,597.8" fill="#5FBFA6"/><polygon points="979.5,588.7 956.9,607.0 979.5,607.0" fill="#7FD3B8"/><polygon points="979.5,588.7 1002.2,607.0 979.5,607.0" fill="#5FBFA6"/><rect x="978.5" y="603.8" width="2.2" height="4.3" fill="#5FBFA6"/><polygon points="990.3,546.7 978.8,567.4 990.3,567.4" fill="#7FD3B8"/><polygon points="990.3,546.7 1001.8,567.4 990.3,567.4" fill="#5FBFA6"/><polygon points="990.3,557.1 975.3,577.8 990.3,577.8" fill="#7FD3B8"/><polygon points="990.3,557.1 1005.3,577.8 990.3,577.8" fill="#5FBFA6"/><polygon points="990.3,567.4 971.7,588.1 990.3,588.1" fill="#7FD3B8"/><polygon points="990.3,567.4 1008.8,588.1 990.3,588.1" fill="#5FBFA6"/><polygon points="990.3,577.8 968.2,598.5 990.3,598.5" fill="#7FD3B8"/><polygon points="990.3,577.8 1012.3,598.5 990.3,598.5" fill="#5FBFA6"/><polygon points="990.3,588.1 964.7,608.8 990.3,608.8" fill="#7FD3B8"/><polygon points="990.3,588.1 1015.8,608.8 990.3,608.8" fill="#5FBFA6"/><rect x="989.1" y="605.2" width="2.4" height="4.9" fill="#5FBFA6"/><polygon points="999.1,550.5 989.7,567.4 999.1,567.4" fill="#7FD3B8"/><polygon points="999.1,550.5 1008.5,567.4 999.1,567.4" fill="#5FBFA6"/><polygon points="999.1,559.0 986.8,575.9 999.1,575.9" fill="#7FD3B8"/><polygon points="999.1,559.0 1011.4,575.9 999.1,575.9" fill="#5FBFA6"/><polygon points="999.1,567.4 983.9,584.4 999.1,584.4" fill="#7FD3B8"/><polygon points="999.1,567.4 1014.3,584.4 999.1,584.4" fill="#5FBFA6"/><polygon points="999.1,575.9 981.1,592.8 999.1,592.8" fill="#7FD3B8"/><polygon points="999.1,575.9 1017.1,592.8 999.1,592.8" fill="#5FBFA6"/><polygon points="999.1,584.4 978.2,601.3 999.1,601.3" fill="#7FD3B8"/><polygon points="999.1,584.4 1020.0,601.3 999.1,601.3" fill="#5FBFA6"/><rect x="998.1" y="598.3" width="2.0" height="4.0" fill="#5FBFA6"/><polygon points="1041.3,536.9 1030.4,556.5 1041.3,556.5" fill="#7FD3B8"/><polygon points="1041.3,536.9 1052.3,556.5 1041.3,556.5" fill="#5FBFA6"/><polygon points="1041.3,546.7 1027.1,566.4 1041.3,566.4" fill="#7FD3B8"/><polygon points="1041.3,546.7 1055.6,566.4 1041.3,566.4" fill="#5FBFA6"/><polygon points="1041.3,556.5 1023.8,576.2 1041.3,576.2" fill="#7FD3B8"/><polygon points="1041.3,556.5 1058.9,576.2 1041.3,576.2" fill="#5FBFA6"/><polygon points="1041.3,566.4 1020.4,586.0 1041.3,586.0" fill="#7FD3B8"/><polygon points="1041.3,566.4 1062.3,586.0 1041.3,586.0" fill="#5FBFA6"/><polygon points="1041.3,576.2 1017.1,595.8 1041.3,595.8" fill="#7FD3B8"/><polygon points="1041.3,576.2 1065.6,595.8 1041.3,595.8" fill="#5FBFA6"/><rect x="1040.2" y="592.3" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="1088.1,558.6 1078.9,575.0 1088.1,575.0" fill="#7FD3B8"/><polygon points="1088.1,558.6 1097.2,575.0 1088.1,575.0" fill="#5FBFA6"/><polygon points="1088.1,566.8 1076.1,583.3 1088.1,583.3" fill="#7FD3B8"/><polygon points="1088.1,566.8 1100.0,583.3 1088.1,583.3" fill="#5FBFA6"/><polygon points="1088.1,575.0 1073.3,591.5 1088.1,591.5" fill="#7FD3B8"/><polygon points="1088.1,575.0 1102.8,591.5 1088.1,591.5" fill="#5FBFA6"/><polygon points="1088.1,583.3 1070.5,599.7 1088.1,599.7" fill="#7FD3B8"/><polygon points="1088.1,583.3 1105.6,599.7 1088.1,599.7" fill="#5FBFA6"/><polygon points="1088.1,591.5 1067.8,608.0 1088.1,608.0" fill="#7FD3B8"/><polygon points="1088.1,591.5 1108.4,608.0 1088.1,608.0" fill="#5FBFA6"/><rect x="1087.1" y="605.1" width="1.9" height="3.9" fill="#5FBFA6"/><polygon points="1088.3,548.4 1077.9,567.0 1088.3,567.0" fill="#7FD3B8"/><polygon points="1088.3,548.4 1098.6,567.0 1088.3,567.0" fill="#5FBFA6"/><polygon points="1088.3,557.7 1074.8,576.3 1088.3,576.3" fill="#7FD3B8"/><polygon points="1088.3,557.7 1101.8,576.3 1088.3,576.3" fill="#5FBFA6"/><polygon points="1088.3,567.0 1071.6,585.6 1088.3,585.6" fill="#7FD3B8"/><polygon points="1088.3,567.0 1104.9,585.6 1088.3,585.6" fill="#5FBFA6"/><polygon points="1088.3,576.3 1068.4,594.9 1088.3,594.9" fill="#7FD3B8"/><polygon points="1088.3,576.3 1108.1,594.9 1088.3,594.9" fill="#5FBFA6"/><polygon points="1088.3,585.6 1065.3,604.2 1088.3,604.2" fill="#7FD3B8"/><polygon points="1088.3,585.6 1111.2,604.2 1088.3,604.2" fill="#5FBFA6"/><rect x="1087.2" y="600.9" width="2.2" height="4.4" fill="#5FBFA6"/><polygon points="1108.8,563.2 1101.2,577.0 1108.8,577.0" fill="#7FD3B8"/><polygon points="1108.8,563.2 1116.5,577.0 1108.8,577.0" fill="#5FBFA6"/><polygon points="1108.8,570.1 1098.9,583.9 1108.8,583.9" fill="#7FD3B8"/><polygon points="1108.8,570.1 1118.8,583.9 1108.8,583.9" fill="#5FBFA6"/><polygon points="1108.8,577.0 1096.5,590.7 1108.8,590.7" fill="#7FD3B8"/><polygon points="1108.8,577.0 1121.2,590.7 1108.8,590.7" fill="#5FBFA6"/><polygon points="1108.8,583.9 1094.2,597.6 1108.8,597.6" fill="#7FD3B8"/><polygon points="1108.8,583.9 1123.5,597.6 1108.8,597.6" fill="#5FBFA6"/><polygon points="1108.8,590.7 1091.8,604.5 1108.8,604.5" fill="#7FD3B8"/><polygon points="1108.8,590.7 1125.8,604.5 1108.8,604.5" fill="#5FBFA6"/><rect x="1108.0" y="602.1" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="1131.6,553.4 1121.9,570.8 1131.6,570.8" fill="#7FD3B8"/><polygon points="1131.6,553.4 1141.2,570.8 1131.6,570.8" fill="#5FBFA6"/><polygon points="1131.6,562.1 1119.0,579.4 1131.6,579.4" fill="#7FD3B8"/><polygon points="1131.6,562.1 1144.2,579.4 1131.6,579.4" fill="#5FBFA6"/><polygon points="1131.6,570.8 1116.0,588.1 1131.6,588.1" fill="#7FD3B8"/><polygon points="1131.6,570.8 1147.1,588.1 1131.6,588.1" fill="#5FBFA6"/><polygon points="1131.6,579.4 1113.1,596.8 1131.6,596.8" fill="#7FD3B8"/><polygon points="1131.6,579.4 1150.1,596.8 1131.6,596.8" fill="#5FBFA6"/><polygon points="1131.6,588.1 1110.1,605.5 1131.6,605.5" fill="#7FD3B8"/><polygon points="1131.6,588.1 1153.0,605.5 1131.6,605.5" fill="#5FBFA6"/><rect x="1130.5" y="602.4" width="2.0" height="4.1" fill="#5FBFA6"/><polygon points="1188.6,555.7 1179.8,571.7 1188.6,571.7" fill="#7FD3B8"/><polygon points="1188.6,555.7 1197.5,571.7 1188.6,571.7" fill="#5FBFA6"/><polygon points="1188.6,563.7 1177.1,579.6 1188.6,579.6" fill="#7FD3B8"/><polygon points="1188.6,563.7 1200.2,579.6 1188.6,579.6" fill="#5FBFA6"/><polygon points="1188.6,571.7 1174.3,587.6 1188.6,587.6" fill="#7FD3B8"/><polygon points="1188.6,571.7 1202.9,587.6 1188.6,587.6" fill="#5FBFA6"/><polygon points="1188.6,579.6 1171.6,595.6 1188.6,595.6" fill="#7FD3B8"/><polygon points="1188.6,579.6 1205.6,595.6 1188.6,595.6" fill="#5FBFA6"/><polygon points="1188.6,587.6 1168.9,603.6 1188.6,603.6" fill="#7FD3B8"/><polygon points="1188.6,587.6 1208.4,603.6 1188.6,603.6" fill="#5FBFA6"/><rect x="1187.7" y="600.8" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="1191.7,545.8 1181.1,564.9 1191.7,564.9" fill="#7FD3B8"/><polygon points="1191.7,545.8 1202.3,564.9 1191.7,564.9" fill="#5FBFA6"/><polygon points="1191.7,555.4 1177.8,574.5 1191.7,574.5" fill="#7FD3B8"/><polygon points="1191.7,555.4 1205.5,574.5 1191.7,574.5" fill="#5FBFA6"/><polygon points="1191.7,564.9 1174.6,584.0 1191.7,584.0" fill="#7FD3B8"/><polygon points="1191.7,564.9 1208.8,584.0 1191.7,584.0" fill="#5FBFA6"/><polygon points="1191.7,574.5 1171.4,593.6 1191.7,593.6" fill="#7FD3B8"/><polygon points="1191.7,574.5 1212.0,593.6 1191.7,593.6" fill="#5FBFA6"/><polygon points="1191.7,584.0 1168.1,603.1 1191.7,603.1" fill="#7FD3B8"/><polygon points="1191.7,584.0 1215.3,603.1 1191.7,603.1" fill="#5FBFA6"/><rect x="1190.6" y="599.7" width="2.2" height="4.5" fill="#5FBFA6"/><polygon points="1202.4,547.5 1192.1,566.1 1202.4,566.1" fill="#7FD3B8"/><polygon points="1202.4,547.5 1212.7,566.1 1202.4,566.1" fill="#5FBFA6"/><polygon points="1202.4,556.8 1188.9,575.4 1202.4,575.4" fill="#7FD3B8"/><polygon points="1202.4,556.8 1215.9,575.4 1202.4,575.4" fill="#5FBFA6"/><polygon points="1202.4,566.1 1185.7,584.7 1202.4,584.7" fill="#7FD3B8"/><polygon points="1202.4,566.1 1219.1,584.7 1202.4,584.7" fill="#5FBFA6"/><polygon points="1202.4,575.4 1182.6,594.0 1202.4,594.0" fill="#7FD3B8"/><polygon points="1202.4,575.4 1222.2,594.0 1202.4,594.0" fill="#5FBFA6"/><polygon points="1202.4,584.7 1179.4,603.3 1202.4,603.3" fill="#7FD3B8"/><polygon points="1202.4,584.7 1225.4,603.3 1202.4,603.3" fill="#5FBFA6"/><rect x="1201.3" y="600.0" width="2.2" height="4.4" fill="#5FBFA6"/><polygon points="1204.7,552.3 1197.1,565.9 1204.7,565.9" fill="#7FD3B8"/><polygon points="1204.7,552.3 1212.3,565.9 1204.7,565.9" fill="#5FBFA6"/><polygon points="1204.7,559.1 1194.8,572.8 1204.7,572.8" fill="#7FD3B8"/><polygon points="1204.7,559.1 1214.6,572.8 1204.7,572.8" fill="#5FBFA6"/><polygon points="1204.7,565.9 1192.4,579.6 1204.7,579.6" fill="#7FD3B8"/><polygon points="1204.7,565.9 1216.9,579.6 1204.7,579.6" fill="#5FBFA6"/><polygon points="1204.7,572.8 1190.1,586.4 1204.7,586.4" fill="#7FD3B8"/><polygon points="1204.7,572.8 1219.2,586.4 1204.7,586.4" fill="#5FBFA6"/><polygon points="1204.7,579.6 1187.8,593.2 1204.7,593.2" fill="#7FD3B8"/><polygon points="1204.7,579.6 1221.5,593.2 1204.7,593.2" fill="#5FBFA6"/><rect x="1203.9" y="590.8" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="1214.3,546.2 1204.3,564.1 1214.3,564.1" fill="#7FD3B8"/><polygon points="1214.3,546.2 1224.3,564.1 1214.3,564.1" fill="#5FBFA6"/><polygon points="1214.3,555.1 1201.2,573.1 1214.3,573.1" fill="#7FD3B8"/><polygon points="1214.3,555.1 1227.3,573.1 1214.3,573.1" fill="#5FBFA6"/><polygon points="1214.3,564.1 1198.2,582.1 1214.3,582.1" fill="#7FD3B8"/><polygon points="1214.3,564.1 1230.4,582.1 1214.3,582.1" fill="#5FBFA6"/><polygon points="1214.3,573.1 1195.1,591.1 1214.3,591.1" fill="#7FD3B8"/><polygon points="1214.3,573.1 1233.5,591.1 1214.3,591.1" fill="#5FBFA6"/><polygon points="1214.3,582.1 1192.1,600.1 1214.3,600.1" fill="#7FD3B8"/><polygon points="1214.3,582.1 1236.5,600.1 1214.3,600.1" fill="#5FBFA6"/><rect x="1213.2" y="596.9" width="2.1" height="4.2" fill="#5FBFA6"/><polygon points="1230.5,541.7 1220.3,560.0 1230.5,560.0" fill="#7FD3B8"/><polygon points="1230.5,541.7 1240.7,560.0 1230.5,560.0" fill="#5FBFA6"/><polygon points="1230.5,550.8 1217.2,569.1 1230.5,569.1" fill="#7FD3B8"/><polygon points="1230.5,550.8 1243.8,569.1 1230.5,569.1" fill="#5FBFA6"/><polygon points="1230.5,560.0 1214.1,578.3 1230.5,578.3" fill="#7FD3B8"/><polygon points="1230.5,560.0 1246.9,578.3 1230.5,578.3" fill="#5FBFA6"/><polygon points="1230.5,569.1 1211.0,587.4 1230.5,587.4" fill="#7FD3B8"/><polygon points="1230.5,569.1 1250.0,587.4 1230.5,587.4" fill="#5FBFA6"/><polygon points="1230.5,578.3 1207.9,596.6 1230.5,596.6" fill="#7FD3B8"/><polygon points="1230.5,578.3 1253.1,596.6 1230.5,596.6" fill="#5FBFA6"/><rect x="1229.4" y="593.4" width="2.2" height="4.3" fill="#5FBFA6"/><polygon points="1246.5,565.0 1239.5,577.6 1246.5,577.6" fill="#7FD3B8"/><polygon points="1246.5,565.0 1253.5,577.6 1246.5,577.6" fill="#5FBFA6"/><polygon points="1246.5,571.3 1237.3,583.9 1246.5,583.9" fill="#7FD3B8"/><polygon points="1246.5,571.3 1255.6,583.9 1246.5,583.9" fill="#5FBFA6"/><polygon points="1246.5,577.6 1235.2,590.2 1246.5,590.2" fill="#7FD3B8"/><polygon points="1246.5,577.6 1257.8,590.2 1246.5,590.2" fill="#5FBFA6"/><polygon points="1246.5,583.9 1233.0,596.5 1246.5,596.5" fill="#7FD3B8"/><polygon points="1246.5,583.9 1259.9,596.5 1246.5,596.5" fill="#5FBFA6"/><polygon points="1246.5,590.2 1230.9,602.8 1246.5,602.8" fill="#7FD3B8"/><polygon points="1246.5,590.2 1262.1,602.8 1246.5,602.8" fill="#5FBFA6"/><rect x="1245.7" y="600.6" width="1.5" height="3.0" fill="#5FBFA6"/><polygon points="1266.1,557.7 1258.2,571.9 1266.1,571.9" fill="#7FD3B8"/><polygon points="1266.1,557.7 1274.1,571.9 1266.1,571.9" fill="#5FBFA6"/><polygon points="1266.1,564.8 1255.8,579.0 1266.1,579.0" fill="#7FD3B8"/><polygon points="1266.1,564.8 1276.5,579.0 1266.1,579.0" fill="#5FBFA6"/><polygon points="1266.1,571.9 1253.4,586.1 1266.1,586.1" fill="#7FD3B8"/><polygon points="1266.1,571.9 1278.9,586.1 1266.1,586.1" fill="#5FBFA6"/><polygon points="1266.1,579.0 1251.0,593.3 1266.1,593.3" fill="#7FD3B8"/><polygon points="1266.1,579.0 1281.3,593.3 1266.1,593.3" fill="#5FBFA6"/><polygon points="1266.1,586.1 1248.5,600.4 1266.1,600.4" fill="#7FD3B8"/><polygon points="1266.1,586.1 1283.7,600.4 1266.1,600.4" fill="#5FBFA6"/><rect x="1265.3" y="597.9" width="1.7" height="3.4" fill="#5FBFA6"/><polygon points="1278.2,553.4 1270.8,566.8 1278.2,566.8" fill="#7FD3B8"/><polygon points="1278.2,553.4 1285.7,566.8 1278.2,566.8" fill="#5FBFA6"/><polygon points="1278.2,560.1 1268.5,573.5 1278.2,573.5" fill="#7FD3B8"/><polygon points="1278.2,560.1 1288.0,573.5 1278.2,573.5" fill="#5FBFA6"/><polygon points="1278.2,566.8 1266.2,580.2 1278.2,580.2" fill="#7FD3B8"/><polygon points="1278.2,566.8 1290.2,580.2 1278.2,580.2" fill="#5FBFA6"/><polygon points="1278.2,573.5 1263.9,586.9 1278.2,586.9" fill="#7FD3B8"/><polygon points="1278.2,573.5 1292.5,586.9 1278.2,586.9" fill="#5FBFA6"/><polygon points="1278.2,580.2 1261.6,593.7 1278.2,593.7" fill="#7FD3B8"/><polygon points="1278.2,580.2 1294.8,593.7 1278.2,593.7" fill="#5FBFA6"/><rect x="1277.4" y="591.3" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="1281.4,556.4 1273.7,570.2 1281.4,570.2" fill="#7FD3B8"/><polygon points="1281.4,556.4 1289.1,570.2 1281.4,570.2" fill="#5FBFA6"/><polygon points="1281.4,563.3 1271.3,577.1 1281.4,577.1" fill="#7FD3B8"/><polygon points="1281.4,563.3 1291.4,577.1 1281.4,577.1" fill="#5FBFA6"/><polygon points="1281.4,570.2 1269.0,584.0 1281.4,584.0" fill="#7FD3B8"/><polygon points="1281.4,570.2 1293.8,584.0 1281.4,584.0" fill="#5FBFA6"/><polygon points="1281.4,577.1 1266.6,591.0 1281.4,591.0" fill="#7FD3B8"/><polygon points="1281.4,577.1 1296.1,591.0 1281.4,591.0" fill="#5FBFA6"/><polygon points="1281.4,584.0 1264.3,597.9 1281.4,597.9" fill="#7FD3B8"/><polygon points="1281.4,584.0 1298.5,597.9 1281.4,597.9" fill="#5FBFA6"/><rect x="1280.6" y="595.4" width="1.6" height="3.3" fill="#5FBFA6"/><polygon points="1281.5,558.2 1274.5,570.7 1281.5,570.7" fill="#7FD3B8"/><polygon points="1281.5,558.2 1288.5,570.7 1281.5,570.7" fill="#5FBFA6"/><polygon points="1281.5,564.4 1272.4,577.0 1281.5,577.0" fill="#7FD3B8"/><polygon points="1281.5,564.4 1290.6,577.0 1281.5,577.0" fill="#5FBFA6"/><polygon points="1281.5,570.7 1270.3,583.3 1281.5,583.3" fill="#7FD3B8"/><polygon points="1281.5,570.7 1292.8,583.3 1281.5,583.3" fill="#5FBFA6"/><polygon points="1281.5,577.0 1268.1,589.6 1281.5,589.6" fill="#7FD3B8"/><polygon points="1281.5,577.0 1294.9,589.6 1281.5,589.6" fill="#5FBFA6"/><polygon points="1281.5,583.3 1266.0,595.8 1281.5,595.8" fill="#7FD3B8"/><polygon points="1281.5,583.3 1297.0,595.8 1281.5,595.8" fill="#5FBFA6"/><rect x="1280.8" y="593.6" width="1.5" height="3.0" fill="#5FBFA6"/><polygon points="1316.0,553.6 1307.3,569.2 1316.0,569.2" fill="#7FD3B8"/><polygon points="1316.0,553.6 1324.7,569.2 1316.0,569.2" fill="#5FBFA6"/><polygon points="1316.0,561.4 1304.7,577.0 1316.0,577.0" fill="#7FD3B8"/><polygon points="1316.0,561.4 1327.3,577.0 1316.0,577.0" fill="#5FBFA6"/><polygon points="1316.0,569.2 1302.0,584.8 1316.0,584.8" fill="#7FD3B8"/><polygon points="1316.0,569.2 1330.0,584.8 1316.0,584.8" fill="#5FBFA6"/><polygon points="1316.0,577.0 1299.4,592.6 1316.0,592.6" fill="#7FD3B8"/><polygon points="1316.0,577.0 1332.6,592.6 1316.0,592.6" fill="#5FBFA6"/><polygon points="1316.0,584.8 1296.7,600.4 1316.0,600.4" fill="#7FD3B8"/><polygon points="1316.0,584.8 1335.3,600.4 1316.0,600.4" fill="#5FBFA6"/><rect x="1315.1" y="597.6" width="1.8" height="3.7" fill="#5FBFA6"/><polygon points="1358.7,550.4 1349.0,567.9 1358.7,567.9" fill="#7FD3B8"/><polygon points="1358.7,550.4 1368.4,567.9 1358.7,567.9" fill="#5FBFA6"/><polygon points="1358.7,559.2 1346.0,576.6 1358.7,576.6" fill="#7FD3B8"/><polygon points="1358.7,559.2 1371.4,576.6 1358.7,576.6" fill="#5FBFA6"/><polygon points="1358.7,567.9 1343.1,585.4 1358.7,585.4" fill="#7FD3B8"/><polygon points="1358.7,567.9 1374.3,585.4 1358.7,585.4" fill="#5FBFA6"/><polygon points="1358.7,576.6 1340.1,594.1 1358.7,594.1" fill="#7FD3B8"/><polygon points="1358.7,576.6 1377.3,594.1 1358.7,594.1" fill="#5FBFA6"/><polygon points="1358.7,585.4 1337.1,602.8 1358.7,602.8" fill="#7FD3B8"/><polygon points="1358.7,585.4 1380.3,602.8 1358.7,602.8" fill="#5FBFA6"/><rect x="1357.7" y="599.7" width="2.1" height="4.1" fill="#5FBFA6"/><polygon points="1382.7,536.3 1371.5,556.5 1382.7,556.5" fill="#7FD3B8"/><polygon points="1382.7,536.3 1393.9,556.5 1382.7,556.5" fill="#5FBFA6"/><polygon points="1382.7,546.4 1368.0,566.7 1382.7,566.7" fill="#7FD3B8"/><polygon points="1382.7,546.4 1397.4,566.7 1382.7,566.7" fill="#5FBFA6"/><polygon points="1382.7,556.5 1364.6,576.8 1382.7,576.8" fill="#7FD3B8"/><polygon points="1382.7,556.5 1400.8,576.8 1382.7,576.8" fill="#5FBFA6"/><polygon points="1382.7,566.7 1361.2,586.9 1382.7,586.9" fill="#7FD3B8"/><polygon points="1382.7,566.7 1404.3,586.9 1382.7,586.9" fill="#5FBFA6"/><polygon points="1382.7,576.8 1357.7,597.0 1382.7,597.0" fill="#7FD3B8"/><polygon points="1382.7,576.8 1407.7,597.0 1382.7,597.0" fill="#5FBFA6"/><rect x="1381.5" y="593.4" width="2.4" height="4.8" fill="#5FBFA6"/><polygon points="1401.7,545.5 1392.9,561.3 1401.7,561.3" fill="#7FD3B8"/><polygon points="1401.7,545.5 1410.5,561.3 1401.7,561.3" fill="#5FBFA6"/><polygon points="1401.7,553.4 1390.2,569.2 1401.7,569.2" fill="#7FD3B8"/><polygon points="1401.7,553.4 1413.2,569.2 1401.7,569.2" fill="#5FBFA6"/><polygon points="1401.7,561.3 1387.5,577.1 1401.7,577.1" fill="#7FD3B8"/><polygon points="1401.7,561.3 1415.8,577.1 1401.7,577.1" fill="#5FBFA6"/><polygon points="1401.7,569.2 1384.8,585.0 1401.7,585.0" fill="#7FD3B8"/><polygon points="1401.7,569.2 1418.5,585.0 1401.7,585.0" fill="#5FBFA6"/><polygon points="1401.7,577.1 1382.1,592.9 1401.7,592.9" fill="#7FD3B8"/><polygon points="1401.7,577.1 1421.2,592.9 1401.7,592.9" fill="#5FBFA6"/><rect x="1400.7" y="590.1" width="1.9" height="3.7" fill="#5FBFA6"/><polygon points="1403.3,549.8 1394.5,565.7 1403.3,565.7" fill="#7FD3B8"/><polygon points="1403.3,549.8 1412.1,565.7 1403.3,565.7" fill="#5FBFA6"/><polygon points="1403.3,557.7 1391.8,573.6 1403.3,573.6" fill="#7FD3B8"/><polygon points="1403.3,557.7 1414.8,573.6 1403.3,573.6" fill="#5FBFA6"/><polygon points="1403.3,565.7 1389.1,581.5 1403.3,581.5" fill="#7FD3B8"/><polygon points="1403.3,565.7 1417.5,581.5 1403.3,581.5" fill="#5FBFA6"/><polygon points="1403.3,573.6 1386.4,589.5 1403.3,589.5" fill="#7FD3B8"/><polygon points="1403.3,573.6 1420.2,589.5 1403.3,589.5" fill="#5FBFA6"/><polygon points="1403.3,581.5 1383.7,597.4 1403.3,597.4" fill="#7FD3B8"/><polygon points="1403.3,581.5 1422.9,597.4 1403.3,597.4" fill="#5FBFA6"/><rect x="1402.4" y="594.6" width="1.9" height="3.7" fill="#5FBFA6"/><polygon points="1437.9,536.2 1427.0,555.8 1437.9,555.8" fill="#7FD3B8"/><polygon points="1437.9,536.2 1448.8,555.8 1437.9,555.8" fill="#5FBFA6"/><polygon points="1437.9,546.0 1423.6,565.6 1437.9,565.6" fill="#7FD3B8"/><polygon points="1437.9,546.0 1452.1,565.6 1437.9,565.6" fill="#5FBFA6"/><polygon points="1437.9,555.8 1420.3,575.4 1437.9,575.4" fill="#7FD3B8"/><polygon points="1437.9,555.8 1455.4,575.4 1437.9,575.4" fill="#5FBFA6"/><polygon points="1437.9,565.6 1417.0,585.2 1437.9,585.2" fill="#7FD3B8"/><polygon points="1437.9,565.6 1458.7,585.2 1437.9,585.2" fill="#5FBFA6"/><polygon points="1437.9,575.4 1413.7,595.0 1437.9,595.0" fill="#7FD3B8"/><polygon points="1437.9,575.4 1462.1,595.0 1437.9,595.0" fill="#5FBFA6"/><rect x="1436.7" y="591.5" width="2.3" height="4.6" fill="#5FBFA6"/><polygon points="1449.5,561.0 1442.5,573.6 1449.5,573.6" fill="#7FD3B8"/><polygon points="1449.5,561.0 1456.4,573.6 1449.5,573.6" fill="#5FBFA6"/><polygon points="1449.5,567.3 1440.3,579.9 1449.5,579.9" fill="#7FD3B8"/><polygon points="1449.5,567.3 1458.6,579.9 1449.5,579.9" fill="#5FBFA6"/><polygon points="1449.5,573.6 1438.2,586.2 1449.5,586.2" fill="#7FD3B8"/><polygon points="1449.5,573.6 1460.7,586.2 1449.5,586.2" fill="#5FBFA6"/><polygon points="1449.5,579.9 1436.1,592.4 1449.5,592.4" fill="#7FD3B8"/><polygon points="1449.5,579.9 1462.8,592.4 1449.5,592.4" fill="#5FBFA6"/><polygon points="1449.5,586.2 1433.9,598.7 1449.5,598.7" fill="#7FD3B8"/><polygon points="1449.5,586.2 1465.0,598.7 1449.5,598.7" fill="#5FBFA6"/><rect x="1448.7" y="596.5" width="1.5" height="3.0" fill="#5FBFA6"/><polygon points="1474.5,563.4 1467.2,576.4 1474.5,576.4" fill="#7FD3B8"/><polygon points="1474.5,563.4 1481.7,576.4 1474.5,576.4" fill="#5FBFA6"/><polygon points="1474.5,569.9 1465.0,583.0 1474.5,583.0" fill="#7FD3B8"/><polygon points="1474.5,569.9 1484.0,583.0 1474.5,583.0" fill="#5FBFA6"/><polygon points="1474.5,576.4 1462.8,589.5 1474.5,589.5" fill="#7FD3B8"/><polygon points="1474.5,576.4 1486.2,589.5 1474.5,589.5" fill="#5FBFA6"/><polygon points="1474.5,583.0 1460.5,596.0 1474.5,596.0" fill="#7FD3B8"/><polygon points="1474.5,583.0 1488.4,596.0 1474.5,596.0" fill="#5FBFA6"/><polygon points="1474.5,589.5 1458.3,602.6 1474.5,602.6" fill="#7FD3B8"/><polygon points="1474.5,589.5 1490.6,602.6 1474.5,602.6" fill="#5FBFA6"/><rect x="1473.7" y="600.3" width="1.5" height="3.1" fill="#5FBFA6"/><polygon points="1477.3,555.9 1468.8,571.1 1477.3,571.1" fill="#7FD3B8"/><polygon points="1477.3,555.9 1485.8,571.1 1477.3,571.1" fill="#5FBFA6"/><polygon points="1477.3,563.5 1466.2,578.8 1477.3,578.8" fill="#7FD3B8"/><polygon points="1477.3,563.5 1488.4,578.8 1477.3,578.8" fill="#5FBFA6"/><polygon points="1477.3,571.1 1463.7,586.4 1477.3,586.4" fill="#7FD3B8"/><polygon points="1477.3,571.1 1491.0,586.4 1477.3,586.4" fill="#5FBFA6"/><polygon points="1477.3,578.8 1461.1,594.0 1477.3,594.0" fill="#7FD3B8"/><polygon points="1477.3,578.8 1493.5,594.0 1477.3,594.0" fill="#5FBFA6"/><polygon points="1477.3,586.4 1458.5,601.6 1477.3,601.6" fill="#7FD3B8"/><polygon points="1477.3,586.4 1496.1,601.6 1477.3,601.6" fill="#5FBFA6"/><rect x="1476.4" y="598.9" width="1.8" height="3.6" fill="#5FBFA6"/><polygon points="1484.2,540.4 1472.7,561.1 1484.2,561.1" fill="#7FD3B8"/><polygon points="1484.2,540.4 1495.7,561.1 1484.2,561.1" fill="#5FBFA6"/><polygon points="1484.2,550.7 1469.1,571.4 1484.2,571.4" fill="#7FD3B8"/><polygon points="1484.2,550.7 1499.2,571.4 1484.2,571.4" fill="#5FBFA6"/><polygon points="1484.2,561.1 1465.6,581.8 1484.2,581.8" fill="#7FD3B8"/><polygon points="1484.2,561.1 1502.7,581.8 1484.2,581.8" fill="#5FBFA6"/><polygon points="1484.2,571.4 1462.1,592.2 1484.2,592.2" fill="#7FD3B8"/><polygon points="1484.2,571.4 1506.2,592.2 1484.2,592.2" fill="#5FBFA6"/><polygon points="1484.2,581.8 1458.6,602.5 1484.2,602.5" fill="#7FD3B8"/><polygon points="1484.2,581.8 1509.8,602.5 1484.2,602.5" fill="#5FBFA6"/><rect x="1482.9" y="598.9" width="2.4" height="4.9" fill="#5FBFA6"/><polygon points="1487.2,558.2 1478.3,574.1 1487.2,574.1" fill="#7FD3B8"/><polygon points="1487.2,558.2 1496.1,574.1 1487.2,574.1" fill="#5FBFA6"/><polygon points="1487.2,566.2 1475.6,582.1 1487.2,582.1" fill="#7FD3B8"/><polygon points="1487.2,566.2 1498.8,582.1 1487.2,582.1" fill="#5FBFA6"/><polygon points="1487.2,574.1 1472.9,590.1 1487.2,590.1" fill="#7FD3B8"/><polygon points="1487.2,574.1 1501.5,590.1 1487.2,590.1" fill="#5FBFA6"/><polygon points="1487.2,582.1 1470.2,598.1 1487.2,598.1" fill="#7FD3B8"/><polygon points="1487.2,582.1 1504.2,598.1 1487.2,598.1" fill="#5FBFA6"/><polygon points="1487.2,590.1 1467.5,606.0 1487.2,606.0" fill="#7FD3B8"/><polygon points="1487.2,590.1 1506.9,606.0 1487.2,606.0" fill="#5FBFA6"/><rect x="1486.3" y="603.2" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="1496.0,552.3 1486.1,570.2 1496.0,570.2" fill="#7FD3B8"/><polygon points="1496.0,552.3 1506.0,570.2 1496.0,570.2" fill="#5FBFA6"/><polygon points="1496.0,561.3 1483.0,579.2 1496.0,579.2" fill="#7FD3B8"/><polygon points="1496.0,561.3 1509.0,579.2 1496.0,579.2" fill="#5FBFA6"/><polygon points="1496.0,570.2 1480.0,588.1 1496.0,588.1" fill="#7FD3B8"/><polygon points="1496.0,570.2 1512.1,588.1 1496.0,588.1" fill="#5FBFA6"/><polygon points="1496.0,579.2 1477.0,597.1 1496.0,597.1" fill="#7FD3B8"/><polygon points="1496.0,579.2 1515.1,597.1 1496.0,597.1" fill="#5FBFA6"/><polygon points="1496.0,588.1 1473.9,606.1 1496.0,606.1" fill="#7FD3B8"/><polygon points="1496.0,588.1 1518.2,606.1 1496.0,606.1" fill="#5FBFA6"/><rect x="1495.0" y="602.9" width="2.1" height="4.2" fill="#5FBFA6"/><polygon points="1514.4,558.2 1506.9,571.7 1514.4,571.7" fill="#7FD3B8"/><polygon points="1514.4,558.2 1521.9,571.7 1514.4,571.7" fill="#5FBFA6"/><polygon points="1514.4,565.0 1504.6,578.5 1514.4,578.5" fill="#7FD3B8"/><polygon points="1514.4,565.0 1524.2,578.5 1514.4,578.5" fill="#5FBFA6"/><polygon points="1514.4,571.7 1502.3,585.2 1514.4,585.2" fill="#7FD3B8"/><polygon points="1514.4,571.7 1526.5,585.2 1514.4,585.2" fill="#5FBFA6"/><polygon points="1514.4,578.5 1500.0,592.0 1514.4,592.0" fill="#7FD3B8"/><polygon points="1514.4,578.5 1528.8,592.0 1514.4,592.0" fill="#5FBFA6"/><polygon points="1514.4,585.2 1497.7,598.7 1514.4,598.7" fill="#7FD3B8"/><polygon points="1514.4,585.2 1531.1,598.7 1514.4,598.7" fill="#5FBFA6"/><rect x="1513.6" y="596.3" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="1516.1,550.9 1506.5,568.1 1516.1,568.1" fill="#7FD3B8"/><polygon points="1516.1,550.9 1525.7,568.1 1516.1,568.1" fill="#5FBFA6"/><polygon points="1516.1,559.5 1503.6,576.7 1516.1,576.7" fill="#7FD3B8"/><polygon points="1516.1,559.5 1528.6,576.7 1516.1,576.7" fill="#5FBFA6"/><polygon points="1516.1,568.1 1500.7,585.3 1516.1,585.3" fill="#7FD3B8"/><polygon points="1516.1,568.1 1531.5,585.3 1516.1,585.3" fill="#5FBFA6"/><polygon points="1516.1,576.7 1497.8,593.9 1516.1,593.9" fill="#7FD3B8"/><polygon points="1516.1,576.7 1534.5,593.9 1516.1,593.9" fill="#5FBFA6"/><polygon points="1516.1,585.3 1494.8,602.5 1516.1,602.5" fill="#7FD3B8"/><polygon points="1516.1,585.3 1537.4,602.5 1516.1,602.5" fill="#5FBFA6"/><rect x="1515.1" y="599.5" width="2.0" height="4.1" fill="#5FBFA6"/><polygon points="1516.8,546.1 1505.2,566.9 1516.8,566.9" fill="#7FD3B8"/><polygon points="1516.8,546.1 1528.3,566.9 1516.8,566.9" fill="#5FBFA6"/><polygon points="1516.8,556.5 1501.7,577.3 1516.8,577.3" fill="#7FD3B8"/><polygon points="1516.8,556.5 1531.9,577.3 1516.8,577.3" fill="#5FBFA6"/><polygon points="1516.8,566.9 1498.1,587.7 1516.8,587.7" fill="#7FD3B8"/><polygon points="1516.8,566.9 1535.4,587.7 1516.8,587.7" fill="#5FBFA6"/><polygon points="1516.8,577.3 1494.6,598.1 1516.8,598.1" fill="#7FD3B8"/><polygon points="1516.8,577.3 1538.9,598.1 1516.8,598.1" fill="#5FBFA6"/><polygon points="1516.8,587.7 1491.1,608.5 1516.8,608.5" fill="#7FD3B8"/><polygon points="1516.8,587.7 1542.5,608.5 1516.8,608.5" fill="#5FBFA6"/><rect x="1515.5" y="604.9" width="2.4" height="4.9" fill="#5FBFA6"/><polygon points="1518.2,556.6 1509.7,572.0 1518.2,572.0" fill="#7FD3B8"/><polygon points="1518.2,556.6 1526.8,572.0 1518.2,572.0" fill="#5FBFA6"/><polygon points="1518.2,564.3 1507.1,579.6 1518.2,579.6" fill="#7FD3B8"/><polygon points="1518.2,564.3 1529.4,579.6 1518.2,579.6" fill="#5FBFA6"/><polygon points="1518.2,572.0 1504.5,587.3 1518.2,587.3" fill="#7FD3B8"/><polygon points="1518.2,572.0 1532.0,587.3 1518.2,587.3" fill="#5FBFA6"/><polygon points="1518.2,579.6 1501.9,595.0 1518.2,595.0" fill="#7FD3B8"/><polygon points="1518.2,579.6 1534.6,595.0 1518.2,595.0" fill="#5FBFA6"/><polygon points="1518.2,587.3 1499.3,602.6 1518.2,602.6" fill="#7FD3B8"/><polygon points="1518.2,587.3 1537.2,602.6 1518.2,602.6" fill="#5FBFA6"/><rect x="1517.3" y="599.9" width="1.8" height="3.6" fill="#5FBFA6"/><polygon points="1522.2,570.3 1515.4,582.5 1522.2,582.5" fill="#7FD3B8"/><polygon points="1522.2,570.3 1529.0,582.5 1522.2,582.5" fill="#5FBFA6"/><polygon points="1522.2,576.4 1513.3,588.6 1522.2,588.6" fill="#7FD3B8"/><polygon points="1522.2,576.4 1531.1,588.6 1522.2,588.6" fill="#5FBFA6"/><polygon points="1522.2,582.5 1511.2,594.8 1522.2,594.8" fill="#7FD3B8"/><polygon points="1522.2,582.5 1533.2,594.8 1522.2,594.8" fill="#5FBFA6"/><polygon points="1522.2,588.6 1509.1,600.9 1522.2,600.9" fill="#7FD3B8"/><polygon points="1522.2,588.6 1535.2,600.9 1522.2,600.9" fill="#5FBFA6"/><polygon points="1522.2,594.8 1507.1,607.0 1522.2,607.0" fill="#7FD3B8"/><polygon points="1522.2,594.8 1537.3,607.0 1522.2,607.0" fill="#5FBFA6"/><rect x="1521.5" y="604.9" width="1.4" height="2.9" fill="#5FBFA6"/><polygon points="1537.4,543.0 1527.8,560.3 1537.4,560.3" fill="#7FD3B8"/><polygon points="1537.4,543.0 1547.0,560.3 1537.4,560.3" fill="#5FBFA6"/><polygon points="1537.4,551.6 1524.9,568.9 1537.4,568.9" fill="#7FD3B8"/><polygon points="1537.4,551.6 1549.9,568.9 1537.4,568.9" fill="#5FBFA6"/><polygon points="1537.4,560.3 1521.9,577.5 1537.4,577.5" fill="#7FD3B8"/><polygon points="1537.4,560.3 1552.8,577.5 1537.4,577.5" fill="#5FBFA6"/><polygon points="1537.4,568.9 1519.0,586.1 1537.4,586.1" fill="#7FD3B8"/><polygon points="1537.4,568.9 1555.8,586.1 1537.4,586.1" fill="#5FBFA6"/><polygon points="1537.4,577.5 1516.1,594.7 1537.4,594.7" fill="#7FD3B8"/><polygon points="1537.4,577.5 1558.7,594.7 1537.4,594.7" fill="#5FBFA6"/><rect x="1536.4" y="591.7" width="2.0" height="4.1" fill="#5FBFA6"/><polygon points="1547.6,562.2 1540.1,575.7 1547.6,575.7" fill="#7FD3B8"/><polygon points="1547.6,562.2 1555.1,575.7 1547.6,575.7" fill="#5FBFA6"/><polygon points="1547.6,568.9 1537.8,582.4 1547.6,582.4" fill="#7FD3B8"/><polygon points="1547.6,568.9 1557.4,582.4 1547.6,582.4" fill="#5FBFA6"/><polygon points="1547.6,575.7 1535.5,589.2 1547.6,589.2" fill="#7FD3B8"/><polygon points="1547.6,575.7 1559.7,589.2 1547.6,589.2" fill="#5FBFA6"/><polygon points="1547.6,582.4 1533.2,595.9 1547.6,595.9" fill="#7FD3B8"/><polygon points="1547.6,582.4 1562.0,595.9 1547.6,595.9" fill="#5FBFA6"/><polygon points="1547.6,589.2 1530.9,602.6 1547.6,602.6" fill="#7FD3B8"/><polygon points="1547.6,589.2 1564.3,602.6 1547.6,602.6" fill="#5FBFA6"/><rect x="1546.8" y="600.3" width="1.6" height="3.2" fill="#5FBFA6"/><polygon points="1555.8,542.9 1544.7,563.0 1555.8,563.0" fill="#7FD3B8"/><polygon points="1555.8,542.9 1567.0,563.0 1555.8,563.0" fill="#5FBFA6"/><polygon points="1555.8,553.0 1541.2,573.1 1555.8,573.1" fill="#7FD3B8"/><polygon points="1555.8,553.0 1570.4,573.1 1555.8,573.1" fill="#5FBFA6"/><polygon points="1555.8,563.0 1537.8,583.1 1555.8,583.1" fill="#7FD3B8"/><polygon points="1555.8,563.0 1573.9,583.1 1555.8,583.1" fill="#5FBFA6"/><polygon points="1555.8,573.1 1534.4,593.2 1555.8,593.2" fill="#7FD3B8"/><polygon points="1555.8,573.1 1577.3,593.2 1555.8,593.2" fill="#5FBFA6"/><polygon points="1555.8,583.1 1531.0,603.3 1555.8,603.3" fill="#7FD3B8"/><polygon points="1555.8,583.1 1580.7,603.3 1555.8,603.3" fill="#5FBFA6"/><rect x="1554.7" y="599.7" width="2.4" height="4.7" fill="#5FBFA6"/><polygon points="1569.7,550.8 1560.7,566.8 1569.7,566.8" fill="#7FD3B8"/><polygon points="1569.7,550.8 1578.6,566.8 1569.7,566.8" fill="#5FBFA6"/><polygon points="1569.7,558.8 1558.0,574.9 1569.7,574.9" fill="#7FD3B8"/><polygon points="1569.7,558.8 1581.3,574.9 1569.7,574.9" fill="#5FBFA6"/><polygon points="1569.7,566.8 1555.3,582.9 1569.7,582.9" fill="#7FD3B8"/><polygon points="1569.7,566.8 1584.0,582.9 1569.7,582.9" fill="#5FBFA6"/><polygon points="1569.7,574.9 1552.6,590.9 1569.7,590.9" fill="#7FD3B8"/><polygon points="1569.7,574.9 1586.8,590.9 1569.7,590.9" fill="#5FBFA6"/><polygon points="1569.7,582.9 1549.8,599.0 1569.7,599.0" fill="#7FD3B8"/><polygon points="1569.7,582.9 1589.5,599.0 1569.7,599.0" fill="#5FBFA6"/><rect x="1568.7" y="596.1" width="1.9" height="3.8" fill="#5FBFA6"/><polygon points="1581.5,552.0 1573.3,566.9 1581.5,566.9" fill="#7FD3B8"/><polygon points="1581.5,552.0 1589.8,566.9 1581.5,566.9" fill="#5FBFA6"/><polygon points="1581.5,559.5 1570.8,574.3 1581.5,574.3" fill="#7FD3B8"/><polygon points="1581.5,559.5 1592.3,574.3 1581.5,574.3" fill="#5FBFA6"/><polygon points="1581.5,566.9 1568.3,581.7 1581.5,581.7" fill="#7FD3B8"/><polygon points="1581.5,566.9 1594.8,581.7 1581.5,581.7" fill="#5FBFA6"/><polygon points="1581.5,574.3 1565.7,589.1 1581.5,589.1" fill="#7FD3B8"/><polygon points="1581.5,574.3 1597.3,589.1 1581.5,589.1" fill="#5FBFA6"/><polygon points="1581.5,581.7 1563.2,596.5 1581.5,596.5" fill="#7FD3B8"/><polygon points="1581.5,581.7 1599.8,596.5 1581.5,596.5" fill="#5FBFA6"/><rect x="1580.7" y="593.9" width="1.7" height="3.5" fill="#5FBFA6"/><path d="M-40 650 C120 610 260 640 420 650 S720 620 900 640 S1300 625 1640 640 L1640 760 L-40 760Z" fill="url(#g2)"/><g transform="translate(210 676) scale(0.9)"><ellipse cx="0" cy="2" rx="34" ry="5" fill="#0f6b66" opacity=".25"/><rect x="-24" y="-30" width="48" height="30" fill="#F7FFF0"/><rect x="0" y="-30" width="24" height="30" fill="#D5F0DF"/><polygon points="-30,-30 0,-52 30,-30" fill="#F2644A"/><polygon points="0,-52 30,-30 0,-30" fill="#D84B35"/><rect x="-14" y="-22" width="9" height="12" fill="#FFE9A8"/><rect x="8" y="-22" width="9" height="12" fill="#FFD27A"/></g><polygon points="11.4,602.8 -0.6,624.4 11.4,624.4" fill="#3FB594"/><polygon points="11.4,602.8 23.4,624.4 11.4,624.4" fill="#2A9C85"/><polygon points="11.4,613.6 -4.2,635.1 11.4,635.1" fill="#3FB594"/><polygon points="11.4,613.6 27.0,635.1 11.4,635.1" fill="#2A9C85"/><polygon points="11.4,624.4 -7.9,645.9 11.4,645.9" fill="#3FB594"/><polygon points="11.4,624.4 30.7,645.9 11.4,645.9" fill="#2A9C85"/><polygon points="11.4,635.1 -11.5,656.7 11.4,656.7" fill="#3FB594"/><polygon points="11.4,635.1 34.3,656.7 11.4,656.7" fill="#2A9C85"/><polygon points="11.4,645.9 -15.2,667.4 11.4,667.4" fill="#3FB594"/><polygon points="11.4,645.9 38.0,667.4 11.4,667.4" fill="#2A9C85"/><rect x="10.1" y="663.6" width="2.5" height="5.1" fill="#2A9C85"/><polygon points="13.6,617.0 2.9,636.2 13.6,636.2" fill="#3FB594"/><polygon points="13.6,617.0 24.3,636.2 13.6,636.2" fill="#2A9C85"/><polygon points="13.6,626.6 -0.4,645.9 13.6,645.9" fill="#3FB594"/><polygon points="13.6,626.6 27.6,645.9 13.6,645.9" fill="#2A9C85"/><polygon points="13.6,636.2 -3.7,655.5 13.6,655.5" fill="#3FB594"/><polygon points="13.6,636.2 30.8,655.5 13.6,655.5" fill="#2A9C85"/><polygon points="13.6,645.9 -6.9,665.1 13.6,665.1" fill="#3FB594"/><polygon points="13.6,645.9 34.1,665.1 13.6,665.1" fill="#2A9C85"/><polygon points="13.6,655.5 -10.2,674.8 13.6,674.8" fill="#3FB594"/><polygon points="13.6,655.5 37.4,674.8 13.6,674.8" fill="#2A9C85"/><rect x="12.5" y="671.4" width="2.3" height="4.5" fill="#2A9C85"/><polygon points="49.0,586.5 34.2,613.1 49.0,613.1" fill="#3FB594"/><polygon points="49.0,586.5 63.8,613.1 49.0,613.1" fill="#2A9C85"/><polygon points="49.0,599.8 29.7,626.4 49.0,626.4" fill="#3FB594"/><polygon points="49.0,599.8 68.3,626.4 49.0,626.4" fill="#2A9C85"/><polygon points="49.0,613.1 25.2,639.7 49.0,639.7" fill="#3FB594"/><polygon points="49.0,613.1 72.8,639.7 49.0,639.7" fill="#2A9C85"/><polygon points="49.0,626.4 20.7,653.0 49.0,653.0" fill="#3FB594"/><polygon points="49.0,626.4 77.4,653.0 49.0,653.0" fill="#2A9C85"/><polygon points="49.0,639.7 16.2,666.3 49.0,666.3" fill="#3FB594"/><polygon points="49.0,639.7 81.9,666.3 49.0,666.3" fill="#2A9C85"/><rect x="47.5" y="661.6" width="3.1" height="6.3" fill="#2A9C85"/><polygon points="388.0,582.6 373.1,609.3 388.0,609.3" fill="#3FB594"/><polygon points="388.0,582.6 402.8,609.3 388.0,609.3" fill="#2A9C85"/><polygon points="388.0,596.0 368.6,622.6 388.0,622.6" fill="#3FB594"/><polygon points="388.0,596.0 407.3,622.6 388.0,622.6" fill="#2A9C85"/><polygon points="388.0,609.3 364.1,636.0 388.0,636.0" fill="#3FB594"/><polygon points="388.0,609.3 411.9,636.0 388.0,636.0" fill="#2A9C85"/><polygon points="388.0,622.6 359.6,649.3 388.0,649.3" fill="#3FB594"/><polygon points="388.0,622.6 416.4,649.3 388.0,649.3" fill="#2A9C85"/><polygon points="388.0,636.0 355.0,662.6 388.0,662.6" fill="#3FB594"/><polygon points="388.0,636.0 420.9,662.6 388.0,662.6" fill="#2A9C85"/><rect x="386.4" y="657.9" width="3.1" height="6.3" fill="#2A9C85"/><polygon points="398.9,606.4 386.7,628.4 398.9,628.4" fill="#3FB594"/><polygon points="398.9,606.4 411.2,628.4 398.9,628.4" fill="#2A9C85"/><polygon points="398.9,617.4 383.0,639.4 398.9,639.4" fill="#3FB594"/><polygon points="398.9,617.4 414.9,639.4 398.9,639.4" fill="#2A9C85"/><polygon points="398.9,628.4 379.2,650.4 398.9,650.4" fill="#3FB594"/><polygon points="398.9,628.4 418.6,650.4 398.9,650.4" fill="#2A9C85"/><polygon points="398.9,639.4 375.5,661.4 398.9,661.4" fill="#3FB594"/><polygon points="398.9,639.4 422.4,661.4 398.9,661.4" fill="#2A9C85"/><polygon points="398.9,650.4 371.7,672.4 398.9,672.4" fill="#3FB594"/><polygon points="398.9,650.4 426.1,672.4 398.9,672.4" fill="#2A9C85"/><rect x="397.6" y="668.5" width="2.6" height="5.2" fill="#2A9C85"/><polygon points="663.1,588.0 648.6,614.1 663.1,614.1" fill="#3FB594"/><polygon points="663.1,588.0 677.6,614.1 663.1,614.1" fill="#2A9C85"/><polygon points="663.1,601.0 644.2,627.1 663.1,627.1" fill="#3FB594"/><polygon points="663.1,601.0 682.0,627.1 663.1,627.1" fill="#2A9C85"/><polygon points="663.1,614.1 639.8,640.1 663.1,640.1" fill="#3FB594"/><polygon points="663.1,614.1 686.4,640.1 663.1,640.1" fill="#2A9C85"/><polygon points="663.1,627.1 635.4,653.1 663.1,653.1" fill="#3FB594"/><polygon points="663.1,627.1 690.8,653.1 663.1,653.1" fill="#2A9C85"/><polygon points="663.1,640.1 630.9,666.1 663.1,666.1" fill="#3FB594"/><polygon points="663.1,640.1 695.2,666.1 663.1,666.1" fill="#2A9C85"/><rect x="661.6" y="661.5" width="3.1" height="6.1" fill="#2A9C85"/><polygon points="682.9,619.7 672.6,638.4 682.9,638.4" fill="#3FB594"/><polygon points="682.9,619.7 693.3,638.4 682.9,638.4" fill="#2A9C85"/><polygon points="682.9,629.0 669.4,647.7 682.9,647.7" fill="#3FB594"/><polygon points="682.9,629.0 696.5,647.7 682.9,647.7" fill="#2A9C85"/><polygon points="682.9,638.4 666.2,657.0 682.9,657.0" fill="#3FB594"/><polygon points="682.9,638.4 699.6,657.0 682.9,657.0" fill="#2A9C85"/><polygon points="682.9,647.7 663.1,666.3 682.9,666.3" fill="#3FB594"/><polygon points="682.9,647.7 702.8,666.3 682.9,666.3" fill="#2A9C85"/><polygon points="682.9,657.0 659.9,675.7 682.9,675.7" fill="#3FB594"/><polygon points="682.9,657.0 706.0,675.7 682.9,675.7" fill="#2A9C85"/><rect x="681.8" y="672.4" width="2.2" height="4.4" fill="#2A9C85"/><polygon points="708.4,599.0 695.4,622.3 708.4,622.3" fill="#3FB594"/><polygon points="708.4,599.0 721.4,622.3 708.4,622.3" fill="#2A9C85"/><polygon points="708.4,610.7 691.5,634.0 708.4,634.0" fill="#3FB594"/><polygon points="708.4,610.7 725.4,634.0 708.4,634.0" fill="#2A9C85"/><polygon points="708.4,622.3 687.5,645.7 708.4,645.7" fill="#3FB594"/><polygon points="708.4,622.3 729.3,645.7 708.4,645.7" fill="#2A9C85"/><polygon points="708.4,634.0 683.5,657.4 708.4,657.4" fill="#3FB594"/><polygon points="708.4,634.0 733.3,657.4 708.4,657.4" fill="#2A9C85"/><polygon points="708.4,645.7 679.6,669.0 708.4,669.0" fill="#3FB594"/><polygon points="708.4,645.7 737.3,669.0 708.4,669.0" fill="#2A9C85"/><rect x="707.0" y="664.9" width="2.7" height="5.5" fill="#2A9C85"/><polygon points="728.1,606.7 716.5,627.5 728.1,627.5" fill="#3FB594"/><polygon points="728.1,606.7 739.7,627.5 728.1,627.5" fill="#2A9C85"/><polygon points="728.1,617.1 713.0,638.0 728.1,638.0" fill="#3FB594"/><polygon points="728.1,617.1 743.2,638.0 728.1,638.0" fill="#2A9C85"/><polygon points="728.1,627.5 709.4,648.4 728.1,648.4" fill="#3FB594"/><polygon points="728.1,627.5 746.7,648.4 728.1,648.4" fill="#2A9C85"/><polygon points="728.1,638.0 705.9,658.8 728.1,658.8" fill="#3FB594"/><polygon points="728.1,638.0 750.3,658.8 728.1,658.8" fill="#2A9C85"/><polygon points="728.1,648.4 702.4,669.2 728.1,669.2" fill="#3FB594"/><polygon points="728.1,648.4 753.8,669.2 728.1,669.2" fill="#2A9C85"/><rect x="726.9" y="665.5" width="2.4" height="4.9" fill="#2A9C85"/><polygon points="742.2,592.5 729.0,616.3 742.2,616.3" fill="#3FB594"/><polygon points="742.2,592.5 755.4,616.3 742.2,616.3" fill="#2A9C85"/><polygon points="742.2,604.4 725.0,628.2 742.2,628.2" fill="#3FB594"/><polygon points="742.2,604.4 759.5,628.2 742.2,628.2" fill="#2A9C85"/><polygon points="742.2,616.3 720.9,640.1 742.2,640.1" fill="#3FB594"/><polygon points="742.2,616.3 763.5,640.1 742.2,640.1" fill="#2A9C85"/><polygon points="742.2,628.2 716.9,652.0 742.2,652.0" fill="#3FB594"/><polygon points="742.2,628.2 767.6,652.0 742.2,652.0" fill="#2A9C85"/><polygon points="742.2,640.1 712.9,663.9 742.2,663.9" fill="#3FB594"/><polygon points="742.2,640.1 771.6,663.9 742.2,663.9" fill="#2A9C85"/><rect x="740.8" y="659.7" width="2.8" height="5.6" fill="#2A9C85"/><polygon points="758.9,620.7 749.0,638.5 758.9,638.5" fill="#3FB594"/><polygon points="758.9,620.7 768.8,638.5 758.9,638.5" fill="#2A9C85"/><polygon points="758.9,629.6 746.0,647.3 758.9,647.3" fill="#3FB594"/><polygon points="758.9,629.6 771.8,647.3 758.9,647.3" fill="#2A9C85"/><polygon points="758.9,638.5 743.0,656.2 758.9,656.2" fill="#3FB594"/><polygon points="758.9,638.5 774.8,656.2 758.9,656.2" fill="#2A9C85"/><polygon points="758.9,647.3 739.9,665.1 758.9,665.1" fill="#3FB594"/><polygon points="758.9,647.3 777.9,665.1 758.9,665.1" fill="#2A9C85"/><polygon points="758.9,656.2 736.9,674.0 758.9,674.0" fill="#3FB594"/><polygon points="758.9,656.2 780.9,674.0 758.9,674.0" fill="#2A9C85"/><rect x="757.9" y="670.9" width="2.1" height="4.2" fill="#2A9C85"/><polygon points="762.6,585.8 747.9,612.3 762.6,612.3" fill="#3FB594"/><polygon points="762.6,585.8 777.4,612.3 762.6,612.3" fill="#2A9C85"/><polygon points="762.6,599.1 743.4,625.5 762.6,625.5" fill="#3FB594"/><polygon points="762.6,599.1 781.8,625.5 762.6,625.5" fill="#2A9C85"/><polygon points="762.6,612.3 738.9,638.8 762.6,638.8" fill="#3FB594"/><polygon points="762.6,612.3 786.3,638.8 762.6,638.8" fill="#2A9C85"/><polygon points="762.6,625.5 734.4,652.0 762.6,652.0" fill="#3FB594"/><polygon points="762.6,625.5 790.8,652.0 762.6,652.0" fill="#2A9C85"/><polygon points="762.6,638.8 729.9,665.2 762.6,665.2" fill="#3FB594"/><polygon points="762.6,638.8 795.3,665.2 762.6,665.2" fill="#2A9C85"/><rect x="761.1" y="660.6" width="3.1" height="6.2" fill="#2A9C85"/><polygon points="770.6,600.1 756.9,624.8 770.6,624.8" fill="#3FB594"/><polygon points="770.6,600.1 784.4,624.8 770.6,624.8" fill="#2A9C85"/><polygon points="770.6,612.4 752.7,637.1 770.6,637.1" fill="#3FB594"/><polygon points="770.6,612.4 788.5,637.1 770.6,637.1" fill="#2A9C85"/><polygon points="770.6,624.8 748.5,649.4 770.6,649.4" fill="#3FB594"/><polygon points="770.6,624.8 792.7,649.4 770.6,649.4" fill="#2A9C85"/><polygon points="770.6,637.1 744.4,661.8 770.6,661.8" fill="#3FB594"/><polygon points="770.6,637.1 796.9,661.8 770.6,661.8" fill="#2A9C85"/><polygon points="770.6,649.4 740.2,674.1 770.6,674.1" fill="#3FB594"/><polygon points="770.6,649.4 801.1,674.1 770.6,674.1" fill="#2A9C85"/><rect x="769.2" y="669.8" width="2.9" height="5.8" fill="#2A9C85"/><polygon points="786.6,585.8 772.5,611.2 786.6,611.2" fill="#3FB594"/><polygon points="786.6,585.8 800.7,611.2 786.6,611.2" fill="#2A9C85"/><polygon points="786.6,598.5 768.2,623.9 786.6,623.9" fill="#3FB594"/><polygon points="786.6,598.5 805.0,623.9 786.6,623.9" fill="#2A9C85"/><polygon points="786.6,611.2 763.9,636.5 786.6,636.5" fill="#3FB594"/><polygon points="786.6,611.2 809.3,636.5 786.6,636.5" fill="#2A9C85"/><polygon points="786.6,623.9 759.6,649.2 786.6,649.2" fill="#3FB594"/><polygon points="786.6,623.9 813.7,649.2 786.6,649.2" fill="#2A9C85"/><polygon points="786.6,636.5 755.3,661.9 786.6,661.9" fill="#3FB594"/><polygon points="786.6,636.5 818.0,661.9 786.6,661.9" fill="#2A9C85"/><rect x="785.2" y="657.4" width="3.0" height="6.0" fill="#2A9C85"/><polygon points="794.0,591.7 778.1,620.3 794.0,620.3" fill="#3FB594"/><polygon points="794.0,591.7 809.9,620.3 794.0,620.3" fill="#2A9C85"/><polygon points="794.0,606.0 773.3,634.5 794.0,634.5" fill="#3FB594"/><polygon points="794.0,606.0 814.7,634.5 794.0,634.5" fill="#2A9C85"/><polygon points="794.0,620.3 768.5,648.8 794.0,648.8" fill="#3FB594"/><polygon points="794.0,620.3 819.6,648.8 794.0,648.8" fill="#2A9C85"/><polygon points="794.0,634.5 763.6,663.1 794.0,663.1" fill="#3FB594"/><polygon points="794.0,634.5 824.4,663.1 794.0,663.1" fill="#2A9C85"/><polygon points="794.0,648.8 758.8,677.3 794.0,677.3" fill="#3FB594"/><polygon points="794.0,648.8 829.3,677.3 794.0,677.3" fill="#2A9C85"/><rect x="792.3" y="672.3" width="3.4" height="6.7" fill="#2A9C85"/><polygon points="848.4,619.6 838.6,637.1 848.4,637.1" fill="#3FB594"/><polygon points="848.4,619.6 858.1,637.1 848.4,637.1" fill="#2A9C85"/><polygon points="848.4,628.3 835.6,645.9 848.4,645.9" fill="#3FB594"/><polygon points="848.4,628.3 861.1,645.9 848.4,645.9" fill="#2A9C85"/><polygon points="848.4,637.1 832.7,654.7 848.4,654.7" fill="#3FB594"/><polygon points="848.4,637.1 864.1,654.7 848.4,654.7" fill="#2A9C85"/><polygon points="848.4,645.9 829.7,663.5 848.4,663.5" fill="#3FB594"/><polygon points="848.4,645.9 867.1,663.5 848.4,663.5" fill="#2A9C85"/><polygon points="848.4,654.7 826.7,672.3 848.4,672.3" fill="#3FB594"/><polygon points="848.4,654.7 870.1,672.3 848.4,672.3" fill="#2A9C85"/><rect x="847.4" y="669.2" width="2.1" height="4.1" fill="#2A9C85"/><polygon points="852.8,616.0 841.9,635.6 852.8,635.6" fill="#3FB594"/><polygon points="852.8,616.0 863.6,635.6 852.8,635.6" fill="#2A9C85"/><polygon points="852.8,625.8 838.6,645.3 852.8,645.3" fill="#3FB594"/><polygon points="852.8,625.8 866.9,645.3 852.8,645.3" fill="#2A9C85"/><polygon points="852.8,635.6 835.3,655.1 852.8,655.1" fill="#3FB594"/><polygon points="852.8,635.6 870.2,655.1 852.8,655.1" fill="#2A9C85"/><polygon points="852.8,645.3 831.9,664.9 852.8,664.9" fill="#3FB594"/><polygon points="852.8,645.3 873.6,664.9 852.8,664.9" fill="#2A9C85"/><polygon points="852.8,655.1 828.6,674.6 852.8,674.6" fill="#3FB594"/><polygon points="852.8,655.1 876.9,674.6 852.8,674.6" fill="#2A9C85"/><rect x="851.6" y="671.2" width="2.3" height="4.6" fill="#2A9C85"/><polygon points="854.3,588.0 838.7,616.0 854.3,616.0" fill="#3FB594"/><polygon points="854.3,588.0 869.8,616.0 854.3,616.0" fill="#2A9C85"/><polygon points="854.3,602.0 833.9,630.0 854.3,630.0" fill="#3FB594"/><polygon points="854.3,602.0 874.6,630.0 854.3,630.0" fill="#2A9C85"/><polygon points="854.3,616.0 829.2,644.0 854.3,644.0" fill="#3FB594"/><polygon points="854.3,616.0 879.4,644.0 854.3,644.0" fill="#2A9C85"/><polygon points="854.3,630.0 824.4,658.0 854.3,658.0" fill="#3FB594"/><polygon points="854.3,630.0 884.1,658.0 854.3,658.0" fill="#2A9C85"/><polygon points="854.3,644.0 819.7,672.0 854.3,672.0" fill="#3FB594"/><polygon points="854.3,644.0 888.9,672.0 854.3,672.0" fill="#2A9C85"/><rect x="852.6" y="667.0" width="3.3" height="6.6" fill="#2A9C85"/><polygon points="873.9,616.8 863.5,635.4 873.9,635.4" fill="#3FB594"/><polygon points="873.9,616.8 884.2,635.4 873.9,635.4" fill="#2A9C85"/><polygon points="873.9,626.1 860.4,644.7 873.9,644.7" fill="#3FB594"/><polygon points="873.9,626.1 887.3,644.7 873.9,644.7" fill="#2A9C85"/><polygon points="873.9,635.4 857.2,653.9 873.9,653.9" fill="#3FB594"/><polygon points="873.9,635.4 890.5,653.9 873.9,653.9" fill="#2A9C85"/><polygon points="873.9,644.7 854.1,663.2 873.9,663.2" fill="#3FB594"/><polygon points="873.9,644.7 893.6,663.2 873.9,663.2" fill="#2A9C85"/><polygon points="873.9,653.9 850.9,672.5 873.9,672.5" fill="#3FB594"/><polygon points="873.9,653.9 896.8,672.5 873.9,672.5" fill="#2A9C85"/><rect x="872.8" y="669.2" width="2.2" height="4.4" fill="#2A9C85"/><polygon points="922.5,583.5 907.2,611.1 922.5,611.1" fill="#3FB594"/><polygon points="922.5,583.5 937.9,611.1 922.5,611.1" fill="#2A9C85"/><polygon points="922.5,597.3 902.5,624.9 922.5,624.9" fill="#3FB594"/><polygon points="922.5,597.3 942.6,624.9 922.5,624.9" fill="#2A9C85"/><polygon points="922.5,611.1 897.8,638.7 922.5,638.7" fill="#3FB594"/><polygon points="922.5,611.1 947.3,638.7 922.5,638.7" fill="#2A9C85"/><polygon points="922.5,624.9 893.1,652.5 922.5,652.5" fill="#3FB594"/><polygon points="922.5,624.9 952.0,652.5 922.5,652.5" fill="#2A9C85"/><polygon points="922.5,638.7 888.4,666.3 922.5,666.3" fill="#3FB594"/><polygon points="922.5,638.7 956.6,666.3 922.5,666.3" fill="#2A9C85"/><rect x="920.9" y="661.4" width="3.2" height="6.5" fill="#2A9C85"/><polygon points="947.1,591.6 933.7,615.7 947.1,615.7" fill="#3FB594"/><polygon points="947.1,591.6 960.5,615.7 947.1,615.7" fill="#2A9C85"/><polygon points="947.1,603.7 929.6,627.7 947.1,627.7" fill="#3FB594"/><polygon points="947.1,603.7 964.6,627.7 947.1,627.7" fill="#2A9C85"/><polygon points="947.1,615.7 925.6,639.8 947.1,639.8" fill="#3FB594"/><polygon points="947.1,615.7 968.7,639.8 947.1,639.8" fill="#2A9C85"/><polygon points="947.1,627.7 921.5,651.8 947.1,651.8" fill="#3FB594"/><polygon points="947.1,627.7 972.7,651.8 947.1,651.8" fill="#2A9C85"/><polygon points="947.1,639.8 917.4,663.8 947.1,663.8" fill="#3FB594"/><polygon points="947.1,639.8 976.8,663.8 947.1,663.8" fill="#2A9C85"/><rect x="945.7" y="659.6" width="2.8" height="5.7" fill="#2A9C85"/><polygon points="955.2,611.1 944.7,630.0 955.2,630.0" fill="#3FB594"/><polygon points="955.2,611.1 965.7,630.0 955.2,630.0" fill="#2A9C85"/><polygon points="955.2,620.6 941.5,639.4 955.2,639.4" fill="#3FB594"/><polygon points="955.2,620.6 968.9,639.4 955.2,639.4" fill="#2A9C85"/><polygon points="955.2,630.0 938.3,648.9 955.2,648.9" fill="#3FB594"/><polygon points="955.2,630.0 972.1,648.9 955.2,648.9" fill="#2A9C85"/><polygon points="955.2,639.4 935.1,658.3 955.2,658.3" fill="#3FB594"/><polygon points="955.2,639.4 975.3,658.3 955.2,658.3" fill="#2A9C85"/><polygon points="955.2,648.9 931.9,667.7 955.2,667.7" fill="#3FB594"/><polygon points="955.2,648.9 978.5,667.7 955.2,667.7" fill="#2A9C85"/><rect x="954.1" y="664.4" width="2.2" height="4.4" fill="#2A9C85"/><polygon points="968.2,618.5 958.5,636.0 968.2,636.0" fill="#3FB594"/><polygon points="968.2,618.5 978.0,636.0 968.2,636.0" fill="#2A9C85"/><polygon points="968.2,627.2 955.5,644.7 968.2,644.7" fill="#3FB594"/><polygon points="968.2,627.2 980.9,644.7 968.2,644.7" fill="#2A9C85"/><polygon points="968.2,636.0 952.6,653.5 968.2,653.5" fill="#3FB594"/><polygon points="968.2,636.0 983.9,653.5 968.2,653.5" fill="#2A9C85"/><polygon points="968.2,644.7 949.6,662.2 968.2,662.2" fill="#3FB594"/><polygon points="968.2,644.7 986.9,662.2 968.2,662.2" fill="#2A9C85"/><polygon points="968.2,653.5 946.6,671.0 968.2,671.0" fill="#3FB594"/><polygon points="968.2,653.5 989.9,671.0 968.2,671.0" fill="#2A9C85"/><rect x="967.2" y="667.9" width="2.1" height="4.1" fill="#2A9C85"/><polygon points="975.0,598.8 963.1,620.2 975.0,620.2" fill="#3FB594"/><polygon points="975.0,598.8 986.9,620.2 975.0,620.2" fill="#2A9C85"/><polygon points="975.0,609.5 959.5,630.9 975.0,630.9" fill="#3FB594"/><polygon points="975.0,609.5 990.5,630.9 975.0,630.9" fill="#2A9C85"/><polygon points="975.0,620.2 955.9,641.6 975.0,641.6" fill="#3FB594"/><polygon points="975.0,620.2 994.2,641.6 975.0,641.6" fill="#2A9C85"/><polygon points="975.0,630.9 952.2,652.3 975.0,652.3" fill="#3FB594"/><polygon points="975.0,630.9 997.8,652.3 975.0,652.3" fill="#2A9C85"/><polygon points="975.0,641.6 948.6,663.0 975.0,663.0" fill="#3FB594"/><polygon points="975.0,641.6 1001.4,663.0 975.0,663.0" fill="#2A9C85"/><rect x="973.8" y="659.2" width="2.5" height="5.0" fill="#2A9C85"/><polygon points="997.1,609.2 987.3,626.9 997.1,626.9" fill="#3FB594"/><polygon points="997.1,609.2 1007.0,626.9 997.1,626.9" fill="#2A9C85"/><polygon points="997.1,618.0 984.3,635.7 997.1,635.7" fill="#3FB594"/><polygon points="997.1,618.0 1010.0,635.7 997.1,635.7" fill="#2A9C85"/><polygon points="997.1,626.9 981.3,644.5 997.1,644.5" fill="#3FB594"/><polygon points="997.1,626.9 1013.0,644.5 997.1,644.5" fill="#2A9C85"/><polygon points="997.1,635.7 978.3,653.4 997.1,653.4" fill="#3FB594"/><polygon points="997.1,635.7 1016.0,653.4 997.1,653.4" fill="#2A9C85"/><polygon points="997.1,644.5 975.3,662.2 997.1,662.2" fill="#3FB594"/><polygon points="997.1,644.5 1019.0,662.2 997.1,662.2" fill="#2A9C85"/><rect x="996.1" y="659.1" width="2.1" height="4.2" fill="#2A9C85"/><polygon points="1014.2,594.0 1000.0,619.5 1014.2,619.5" fill="#3FB594"/><polygon points="1014.2,594.0 1028.4,619.5 1014.2,619.5" fill="#2A9C85"/><polygon points="1014.2,606.8 995.7,632.3 1014.2,632.3" fill="#3FB594"/><polygon points="1014.2,606.8 1032.8,632.3 1014.2,632.3" fill="#2A9C85"/><polygon points="1014.2,619.5 991.3,645.1 1014.2,645.1" fill="#3FB594"/><polygon points="1014.2,619.5 1037.1,645.1 1014.2,645.1" fill="#2A9C85"/><polygon points="1014.2,632.3 987.0,657.9 1014.2,657.9" fill="#3FB594"/><polygon points="1014.2,632.3 1041.5,657.9 1014.2,657.9" fill="#2A9C85"/><polygon points="1014.2,645.1 982.6,670.7 1014.2,670.7" fill="#3FB594"/><polygon points="1014.2,645.1 1045.8,670.7 1014.2,670.7" fill="#2A9C85"/><rect x="1012.7" y="666.2" width="3.0" height="6.0" fill="#2A9C85"/><polygon points="1034.7,619.5 1024.4,638.0 1034.7,638.0" fill="#3FB594"/><polygon points="1034.7,619.5 1045.0,638.0 1034.7,638.0" fill="#2A9C85"/><polygon points="1034.7,628.8 1021.2,647.3 1034.7,647.3" fill="#3FB594"/><polygon points="1034.7,628.8 1048.2,647.3 1034.7,647.3" fill="#2A9C85"/><polygon points="1034.7,638.0 1018.1,656.6 1034.7,656.6" fill="#3FB594"/><polygon points="1034.7,638.0 1051.3,656.6 1034.7,656.6" fill="#2A9C85"/><polygon points="1034.7,647.3 1014.9,665.9 1034.7,665.9" fill="#3FB594"/><polygon points="1034.7,647.3 1054.5,665.9 1034.7,665.9" fill="#2A9C85"/><polygon points="1034.7,656.6 1011.8,675.1 1034.7,675.1" fill="#3FB594"/><polygon points="1034.7,656.6 1057.6,675.1 1034.7,675.1" fill="#2A9C85"/><rect x="1033.6" y="671.9" width="2.2" height="4.4" fill="#2A9C85"/><polygon points="1137.3,606.2 1125.8,626.8 1137.3,626.8" fill="#3FB594"/><polygon points="1137.3,606.2 1148.7,626.8 1137.3,626.8" fill="#2A9C85"/><polygon points="1137.3,616.5 1122.3,637.2 1137.3,637.2" fill="#3FB594"/><polygon points="1137.3,616.5 1152.2,637.2 1137.3,637.2" fill="#2A9C85"/><polygon points="1137.3,626.8 1118.8,647.5 1137.3,647.5" fill="#3FB594"/><polygon points="1137.3,626.8 1155.7,647.5 1137.3,647.5" fill="#2A9C85"/><polygon points="1137.3,637.2 1115.3,657.8 1137.3,657.8" fill="#3FB594"/><polygon points="1137.3,637.2 1159.2,657.8 1137.3,657.8" fill="#2A9C85"/><polygon points="1137.3,647.5 1111.8,668.1 1137.3,668.1" fill="#3FB594"/><polygon points="1137.3,647.5 1162.7,668.1 1137.3,668.1" fill="#2A9C85"/><rect x="1136.0" y="664.5" width="2.4" height="4.9" fill="#2A9C85"/><polygon points="1194.4,603.0 1181.8,625.6 1194.4,625.6" fill="#3FB594"/><polygon points="1194.4,603.0 1207.0,625.6 1194.4,625.6" fill="#2A9C85"/><polygon points="1194.4,614.3 1178.0,636.9 1194.4,636.9" fill="#3FB594"/><polygon points="1194.4,614.3 1210.9,636.9 1194.4,636.9" fill="#2A9C85"/><polygon points="1194.4,625.6 1174.1,648.3 1194.4,648.3" fill="#3FB594"/><polygon points="1194.4,625.6 1214.7,648.3 1194.4,648.3" fill="#2A9C85"/><polygon points="1194.4,636.9 1170.3,659.6 1194.4,659.6" fill="#3FB594"/><polygon points="1194.4,636.9 1218.6,659.6 1194.4,659.6" fill="#2A9C85"/><polygon points="1194.4,648.3 1166.4,670.9 1194.4,670.9" fill="#3FB594"/><polygon points="1194.4,648.3 1222.4,670.9 1194.4,670.9" fill="#2A9C85"/><rect x="1193.1" y="666.9" width="2.7" height="5.3" fill="#2A9C85"/><polygon points="1196.9,612.3 1185.1,633.6 1196.9,633.6" fill="#3FB594"/><polygon points="1196.9,612.3 1208.8,633.6 1196.9,633.6" fill="#2A9C85"/><polygon points="1196.9,623.0 1181.5,644.3 1196.9,644.3" fill="#3FB594"/><polygon points="1196.9,623.0 1212.4,644.3 1196.9,644.3" fill="#2A9C85"/><polygon points="1196.9,633.6 1177.8,654.9 1196.9,654.9" fill="#3FB594"/><polygon points="1196.9,633.6 1216.0,654.9 1196.9,654.9" fill="#2A9C85"/><polygon points="1196.9,644.3 1174.2,665.6 1196.9,665.6" fill="#3FB594"/><polygon points="1196.9,644.3 1219.6,665.6 1196.9,665.6" fill="#2A9C85"/><polygon points="1196.9,654.9 1170.6,676.3 1196.9,676.3" fill="#3FB594"/><polygon points="1196.9,654.9 1223.3,676.3 1196.9,676.3" fill="#2A9C85"/><rect x="1195.7" y="672.5" width="2.5" height="5.0" fill="#2A9C85"/><polygon points="1221.8,587.2 1207.9,612.2 1221.8,612.2" fill="#3FB594"/><polygon points="1221.8,587.2 1235.8,612.2 1221.8,612.2" fill="#2A9C85"/><polygon points="1221.8,599.7 1203.7,624.8 1221.8,624.8" fill="#3FB594"/><polygon points="1221.8,599.7 1240.0,624.8 1221.8,624.8" fill="#2A9C85"/><polygon points="1221.8,612.2 1199.4,637.3 1221.8,637.3" fill="#3FB594"/><polygon points="1221.8,612.2 1244.3,637.3 1221.8,637.3" fill="#2A9C85"/><polygon points="1221.8,624.8 1195.1,649.8 1221.8,649.8" fill="#3FB594"/><polygon points="1221.8,624.8 1248.5,649.8 1221.8,649.8" fill="#2A9C85"/><polygon points="1221.8,637.3 1190.9,662.4 1221.8,662.4" fill="#3FB594"/><polygon points="1221.8,637.3 1252.8,662.4 1221.8,662.4" fill="#2A9C85"/><rect x="1220.4" y="657.9" width="2.9" height="5.9" fill="#2A9C85"/><polygon points="1251.0,591.0 1237.5,615.3 1251.0,615.3" fill="#3FB594"/><polygon points="1251.0,591.0 1264.5,615.3 1251.0,615.3" fill="#2A9C85"/><polygon points="1251.0,603.1 1233.3,627.4 1251.0,627.4" fill="#3FB594"/><polygon points="1251.0,603.1 1268.6,627.4 1251.0,627.4" fill="#2A9C85"/><polygon points="1251.0,615.3 1229.2,639.5 1251.0,639.5" fill="#3FB594"/><polygon points="1251.0,615.3 1272.7,639.5 1251.0,639.5" fill="#2A9C85"/><polygon points="1251.0,627.4 1225.1,651.7 1251.0,651.7" fill="#3FB594"/><polygon points="1251.0,627.4 1276.9,651.7 1251.0,651.7" fill="#2A9C85"/><polygon points="1251.0,639.5 1221.0,663.8 1251.0,663.8" fill="#3FB594"/><polygon points="1251.0,639.5 1281.0,663.8 1251.0,663.8" fill="#2A9C85"/><rect x="1249.6" y="659.6" width="2.9" height="5.7" fill="#2A9C85"/><polygon points="1256.4,587.1 1241.1,614.7 1256.4,614.7" fill="#3FB594"/><polygon points="1256.4,587.1 1271.7,614.7 1256.4,614.7" fill="#2A9C85"/><polygon points="1256.4,600.9 1236.4,628.4 1256.4,628.4" fill="#3FB594"/><polygon points="1256.4,600.9 1276.3,628.4 1256.4,628.4" fill="#2A9C85"/><polygon points="1256.4,614.7 1231.7,642.2 1256.4,642.2" fill="#3FB594"/><polygon points="1256.4,614.7 1281.0,642.2 1256.4,642.2" fill="#2A9C85"/><polygon points="1256.4,628.4 1227.0,656.0 1256.4,656.0" fill="#3FB594"/><polygon points="1256.4,628.4 1285.7,656.0 1256.4,656.0" fill="#2A9C85"/><polygon points="1256.4,642.2 1222.4,669.7 1256.4,669.7" fill="#3FB594"/><polygon points="1256.4,642.2 1290.4,669.7 1256.4,669.7" fill="#2A9C85"/><rect x="1254.7" y="664.9" width="3.2" height="6.5" fill="#2A9C85"/><polygon points="1256.7,597.8 1243.2,621.9 1256.7,621.9" fill="#3FB594"/><polygon points="1256.7,597.8 1270.1,621.9 1256.7,621.9" fill="#2A9C85"/><polygon points="1256.7,609.9 1239.1,634.0 1256.7,634.0" fill="#3FB594"/><polygon points="1256.7,609.9 1274.2,634.0 1256.7,634.0" fill="#2A9C85"/><polygon points="1256.7,621.9 1235.0,646.1 1256.7,646.1" fill="#3FB594"/><polygon points="1256.7,621.9 1278.3,646.1 1256.7,646.1" fill="#2A9C85"/><polygon points="1256.7,634.0 1230.9,658.2 1256.7,658.2" fill="#3FB594"/><polygon points="1256.7,634.0 1282.4,658.2 1256.7,658.2" fill="#2A9C85"/><polygon points="1256.7,646.1 1226.8,670.3 1256.7,670.3" fill="#3FB594"/><polygon points="1256.7,646.1 1286.6,670.3 1256.7,670.3" fill="#2A9C85"/><rect x="1255.3" y="666.0" width="2.8" height="5.7" fill="#2A9C85"/><polygon points="1329.4,595.5 1316.4,618.8 1329.4,618.8" fill="#3FB594"/><polygon points="1329.4,595.5 1342.4,618.8 1329.4,618.8" fill="#2A9C85"/><polygon points="1329.4,607.1 1312.5,630.5 1329.4,630.5" fill="#3FB594"/><polygon points="1329.4,607.1 1346.4,630.5 1329.4,630.5" fill="#2A9C85"/><polygon points="1329.4,618.8 1308.5,642.2 1329.4,642.2" fill="#3FB594"/><polygon points="1329.4,618.8 1350.4,642.2 1329.4,642.2" fill="#2A9C85"/><polygon points="1329.4,630.5 1304.5,653.9 1329.4,653.9" fill="#3FB594"/><polygon points="1329.4,630.5 1354.3,653.9 1329.4,653.9" fill="#2A9C85"/><polygon points="1329.4,642.2 1300.5,665.6 1329.4,665.6" fill="#3FB594"/><polygon points="1329.4,642.2 1358.3,665.6 1329.4,665.6" fill="#2A9C85"/><rect x="1328.0" y="661.5" width="2.8" height="5.5" fill="#2A9C85"/><polygon points="1428.5,588.5 1414.2,614.2 1428.5,614.2" fill="#3FB594"/><polygon points="1428.5,588.5 1442.7,614.2 1428.5,614.2" fill="#2A9C85"/><polygon points="1428.5,601.4 1409.8,627.1 1428.5,627.1" fill="#3FB594"/><polygon points="1428.5,601.4 1447.1,627.1 1428.5,627.1" fill="#2A9C85"/><polygon points="1428.5,614.2 1405.5,639.9 1428.5,639.9" fill="#3FB594"/><polygon points="1428.5,614.2 1451.5,639.9 1428.5,639.9" fill="#2A9C85"/><polygon points="1428.5,627.1 1401.1,652.7 1428.5,652.7" fill="#3FB594"/><polygon points="1428.5,627.1 1455.8,652.7 1428.5,652.7" fill="#2A9C85"/><polygon points="1428.5,639.9 1396.7,665.6 1428.5,665.6" fill="#3FB594"/><polygon points="1428.5,639.9 1460.2,665.6 1428.5,665.6" fill="#2A9C85"/><rect x="1427.0" y="661.0" width="3.0" height="6.0" fill="#2A9C85"/><polygon points="1467.0,613.7 1456.7,632.3 1467.0,632.3" fill="#3FB594"/><polygon points="1467.0,613.7 1477.3,632.3 1467.0,632.3" fill="#2A9C85"/><polygon points="1467.0,623.0 1453.5,641.5 1467.0,641.5" fill="#3FB594"/><polygon points="1467.0,623.0 1480.4,641.5 1467.0,641.5" fill="#2A9C85"/><polygon points="1467.0,632.3 1450.4,650.8 1467.0,650.8" fill="#3FB594"/><polygon points="1467.0,632.3 1483.6,650.8 1467.0,650.8" fill="#2A9C85"/><polygon points="1467.0,641.5 1447.2,660.1 1467.0,660.1" fill="#3FB594"/><polygon points="1467.0,641.5 1486.7,660.1 1467.0,660.1" fill="#2A9C85"/><polygon points="1467.0,650.8 1444.1,669.4 1467.0,669.4" fill="#3FB594"/><polygon points="1467.0,650.8 1489.9,669.4 1467.0,669.4" fill="#2A9C85"/><rect x="1465.9" y="666.1" width="2.2" height="4.4" fill="#2A9C85"/><polygon points="1470.3,601.1 1458.4,622.4 1470.3,622.4" fill="#3FB594"/><polygon points="1470.3,601.1 1482.1,622.4 1470.3,622.4" fill="#2A9C85"/><polygon points="1470.3,611.8 1454.8,633.1 1470.3,633.1" fill="#3FB594"/><polygon points="1470.3,611.8 1485.7,633.1 1470.3,633.1" fill="#2A9C85"/><polygon points="1470.3,622.4 1451.2,643.7 1470.3,643.7" fill="#3FB594"/><polygon points="1470.3,622.4 1489.3,643.7 1470.3,643.7" fill="#2A9C85"/><polygon points="1470.3,633.1 1447.6,654.4 1470.3,654.4" fill="#3FB594"/><polygon points="1470.3,633.1 1493.0,654.4 1470.3,654.4" fill="#2A9C85"/><polygon points="1470.3,643.7 1444.0,665.0 1470.3,665.0" fill="#3FB594"/><polygon points="1470.3,643.7 1496.6,665.0 1470.3,665.0" fill="#2A9C85"/><rect x="1469.0" y="661.2" width="2.5" height="5.0" fill="#2A9C85"/><polygon points="1474.8,615.7 1464.2,634.8 1474.8,634.8" fill="#3FB594"/><polygon points="1474.8,615.7 1485.5,634.8 1474.8,634.8" fill="#2A9C85"/><polygon points="1474.8,625.2 1461.0,644.3 1474.8,644.3" fill="#3FB594"/><polygon points="1474.8,625.2 1488.7,644.3 1474.8,644.3" fill="#2A9C85"/><polygon points="1474.8,634.8 1457.8,653.8 1474.8,653.8" fill="#3FB594"/><polygon points="1474.8,634.8 1491.9,653.8 1474.8,653.8" fill="#2A9C85"/><polygon points="1474.8,644.3 1454.5,663.4 1474.8,663.4" fill="#3FB594"/><polygon points="1474.8,644.3 1495.2,663.4 1474.8,663.4" fill="#2A9C85"/><polygon points="1474.8,653.8 1451.3,672.9 1474.8,672.9" fill="#3FB594"/><polygon points="1474.8,653.8 1498.4,672.9 1474.8,672.9" fill="#2A9C85"/><rect x="1473.7" y="669.5" width="2.2" height="4.5" fill="#2A9C85"/><polygon points="1505.1,599.1 1491.5,623.7 1505.1,623.7" fill="#3FB594"/><polygon points="1505.1,599.1 1518.8,623.7 1505.1,623.7" fill="#2A9C85"/><polygon points="1505.1,611.4 1487.3,636.0 1505.1,636.0" fill="#3FB594"/><polygon points="1505.1,611.4 1522.9,636.0 1505.1,636.0" fill="#2A9C85"/><polygon points="1505.1,623.7 1483.1,648.3 1505.1,648.3" fill="#3FB594"/><polygon points="1505.1,623.7 1527.1,648.3 1505.1,648.3" fill="#2A9C85"/><polygon points="1505.1,636.0 1478.9,660.6 1505.1,660.6" fill="#3FB594"/><polygon points="1505.1,636.0 1531.3,660.6 1505.1,660.6" fill="#2A9C85"/><polygon points="1505.1,648.3 1474.8,672.9 1505.1,672.9" fill="#3FB594"/><polygon points="1505.1,648.3 1535.5,672.9 1505.1,672.9" fill="#2A9C85"/><rect x="1503.7" y="668.5" width="2.9" height="5.8" fill="#2A9C85"/><polygon points="1547.0,588.7 1533.3,613.4 1547.0,613.4" fill="#3FB594"/><polygon points="1547.0,588.7 1560.8,613.4 1547.0,613.4" fill="#2A9C85"/><polygon points="1547.0,601.0 1529.1,625.7 1547.0,625.7" fill="#3FB594"/><polygon points="1547.0,601.0 1565.0,625.7 1547.0,625.7" fill="#2A9C85"/><polygon points="1547.0,613.4 1524.9,638.1 1547.0,638.1" fill="#3FB594"/><polygon points="1547.0,613.4 1569.2,638.1 1547.0,638.1" fill="#2A9C85"/><polygon points="1547.0,625.7 1520.7,650.5 1547.0,650.5" fill="#3FB594"/><polygon points="1547.0,625.7 1573.4,650.5 1547.0,650.5" fill="#2A9C85"/><polygon points="1547.0,638.1 1516.5,662.8 1547.0,662.8" fill="#3FB594"/><polygon points="1547.0,638.1 1577.6,662.8 1547.0,662.8" fill="#2A9C85"/><rect x="1545.6" y="658.5" width="2.9" height="5.8" fill="#2A9C85"/><polygon points="1565.4,607.2 1555.1,625.7 1565.4,625.7" fill="#3FB594"/><polygon points="1565.4,607.2 1575.6,625.7 1565.4,625.7" fill="#2A9C85"/><polygon points="1565.4,616.4 1552.0,634.9 1565.4,634.9" fill="#3FB594"/><polygon points="1565.4,616.4 1578.8,634.9 1565.4,634.9" fill="#2A9C85"/><polygon points="1565.4,625.7 1548.9,644.1 1565.4,644.1" fill="#3FB594"/><polygon points="1565.4,625.7 1581.9,644.1 1565.4,644.1" fill="#2A9C85"/><polygon points="1565.4,634.9 1545.7,653.3 1565.4,653.3" fill="#3FB594"/><polygon points="1565.4,634.9 1585.0,653.3 1565.4,653.3" fill="#2A9C85"/><polygon points="1565.4,644.1 1542.6,662.5 1565.4,662.5" fill="#3FB594"/><polygon points="1565.4,644.1 1588.2,662.5 1565.4,662.5" fill="#2A9C85"/><rect x="1564.3" y="659.3" width="2.2" height="4.3" fill="#2A9C85"/><polygon points="1579.2,611.4 1568.2,631.1 1579.2,631.1" fill="#3FB594"/><polygon points="1579.2,611.4 1590.2,631.1 1579.2,631.1" fill="#2A9C85"/><polygon points="1579.2,621.3 1564.8,641.0 1579.2,641.0" fill="#3FB594"/><polygon points="1579.2,621.3 1593.5,641.0 1579.2,641.0" fill="#2A9C85"/><polygon points="1579.2,631.1 1561.5,650.9 1579.2,650.9" fill="#3FB594"/><polygon points="1579.2,631.1 1596.9,650.9 1579.2,650.9" fill="#2A9C85"/><polygon points="1579.2,641.0 1558.1,660.8 1579.2,660.8" fill="#3FB594"/><polygon points="1579.2,641.0 1600.2,660.8 1579.2,660.8" fill="#2A9C85"/><polygon points="1579.2,650.9 1554.8,670.7 1579.2,670.7" fill="#3FB594"/><polygon points="1579.2,650.9 1603.6,670.7 1579.2,670.7" fill="#2A9C85"/><rect x="1578.0" y="667.2" width="2.3" height="4.6" fill="#2A9C85"/><polygon points="1584.5,607.7 1572.0,630.2 1584.5,630.2" fill="#3FB594"/><polygon points="1584.5,607.7 1597.1,630.2 1584.5,630.2" fill="#2A9C85"/><polygon points="1584.5,619.0 1568.2,641.5 1584.5,641.5" fill="#3FB594"/><polygon points="1584.5,619.0 1600.9,641.5 1584.5,641.5" fill="#2A9C85"/><polygon points="1584.5,630.2 1564.3,652.8 1584.5,652.8" fill="#3FB594"/><polygon points="1584.5,630.2 1604.7,652.8 1584.5,652.8" fill="#2A9C85"/><polygon points="1584.5,641.5 1560.5,664.1 1584.5,664.1" fill="#3FB594"/><polygon points="1584.5,641.5 1608.6,664.1 1584.5,664.1" fill="#2A9C85"/><polygon points="1584.5,652.8 1556.7,675.4 1584.5,675.4" fill="#3FB594"/><polygon points="1584.5,652.8 1612.4,675.4 1584.5,675.4" fill="#2A9C85"/><rect x="1583.2" y="671.4" width="2.7" height="5.3" fill="#2A9C85"/><polygon points="1591.9,588.1 1577.3,614.3 1591.9,614.3" fill="#3FB594"/><polygon points="1591.9,588.1 1606.5,614.3 1591.9,614.3" fill="#2A9C85"/><polygon points="1591.9,601.2 1572.9,627.4 1591.9,627.4" fill="#3FB594"/><polygon points="1591.9,601.2 1610.9,627.4 1591.9,627.4" fill="#2A9C85"/><polygon points="1591.9,614.3 1568.4,640.5 1591.9,640.5" fill="#3FB594"/><polygon points="1591.9,614.3 1615.4,640.5 1591.9,640.5" fill="#2A9C85"/><polygon points="1591.9,627.4 1564.0,653.6 1591.9,653.6" fill="#3FB594"/><polygon points="1591.9,627.4 1619.8,653.6 1591.9,653.6" fill="#2A9C85"/><polygon points="1591.9,640.5 1559.5,666.7 1591.9,666.7" fill="#3FB594"/><polygon points="1591.9,640.5 1624.3,666.7 1591.9,666.7" fill="#2A9C85"/><rect x="1590.4" y="662.1" width="3.1" height="6.2" fill="#2A9C85"/><rect x="-20" y="740" width="1680" height="190" fill="#6FCB9E"/><g clip-path="url(#ground)"><polygon points="559.2,592.0 558.2,594.5 556.5,597.1 554.7,599.6 553.1,602.2 551.4,604.8 549.8,607.3 548.2,609.9 546.7,612.4 545.1,615.0 543.6,617.5 542.2,620.0 540.7,622.6 539.3,625.1 537.9,627.7 536.6,630.2 535.2,632.8 533.9,635.4 532.6,637.9 531.3,640.5 530.0,643.0 528.7,645.5 527.4,648.1 526.2,650.6 524.9,653.2 523.6,655.8 522.4,658.3 521.1,660.9 519.8,663.4 518.5,666.0 517.2,668.5 515.9,671.0 514.6,673.6 513.2,676.1 511.8,678.7 510.4,681.2 509.0,683.8 507.5,686.4 506.0,688.9 504.5,691.5 502.9,694.0 501.3,696.5 499.6,699.1 497.9,701.6 496.2,704.2 494.4,706.8 492.6,709.3 490.7,711.9 488.8,714.4 486.8,717.0 484.8,719.5 482.7,722.0 480.5,724.6 478.3,727.1 476.1,729.7 473.8,732.2 471.4,734.8 469.0,737.4 466.6,739.9 464.0,742.5 461.5,745.0 458.8,747.5 456.2,750.1 453.4,752.6 450.7,755.2 447.9,757.8 445.0,760.3 442.1,762.9 439.2,765.4 436.2,768.0 433.2,770.5 430.1,773.0 427.0,775.6 423.9,778.1 420.8,780.7 417.6,783.2 414.4,785.8 411.2,788.4 408.0,790.9 404.8,793.5 401.6,796.0 398.3,798.5 395.1,801.1 391.9,803.6 388.7,806.2 385.5,808.8 382.3,811.3 379.1,813.9 376.0,816.4 372.9,819.0 369.8,821.5 366.7,824.0 363.7,826.6 360.8,829.1 357.9,831.7 355.0,834.2 352.2,836.8 349.4,839.4 346.7,841.9 344.1,844.5 341.5,847.0 339.1,849.5 336.6,852.1 334.3,854.6 332.0,857.2 329.9,859.8 327.8,862.3 325.8,864.9 323.8,867.4 322.0,870.0 320.3,872.5 318.6,875.0 317.1,877.6 315.6,880.1 314.2,882.7 313.0,885.2 311.8,887.8 310.7,890.4 309.8,892.9 308.9,895.5 308.1,898.0 307.4,900.5 306.8,903.1 306.3,905.6 305.9,908.2 305.6,910.8 305.3,913.3 305.2,915.9 305.1,918.4 305.1,921.0 305.2,923.5 305.4,926.0 305.6,928.6 305.9,931.1 306.3,933.7 306.7,936.2 307.2,938.8 307.7,941.4 308.3,943.9 308.9,946.5 309.5,949.0 310.2,951.5 310.9,954.1 311.6,956.6 312.3,959.2 313.1,961.8 313.8,964.3 314.6,966.9 315.3,969.4 316.0,972.0 316.7,974.5 317.4,977.0 318.1,979.6 318.7,982.1 319.2,984.7 319.8,987.2 320.2,989.8 320.6,992.4 321.0,994.9 321.2,997.5 321.4,1000.0 598.9,1000.0 597.0,997.5 594.9,994.9 592.9,992.4 590.7,989.8 588.5,987.2 586.3,984.7 584.0,982.1 581.6,979.6 579.2,977.0 576.8,974.5 574.4,972.0 571.9,969.4 569.5,966.9 567.0,964.3 564.5,961.8 562.0,959.2 559.6,956.6 557.1,954.1 554.7,951.5 552.3,949.0 549.9,946.5 547.5,943.9 545.2,941.4 543.0,938.8 540.8,936.2 538.6,933.7 536.5,931.1 534.5,928.6 532.5,926.0 530.6,923.5 528.8,921.0 527.1,918.4 525.4,915.9 523.8,913.3 522.3,910.8 520.9,908.2 519.6,905.6 518.4,903.1 517.2,900.5 516.2,898.0 515.2,895.5 514.4,892.9 513.6,890.4 513.0,887.8 512.4,885.2 511.9,882.7 511.5,880.1 511.3,877.6 511.1,875.0 511.0,872.5 511.0,870.0 511.1,867.4 511.3,864.9 511.6,862.3 511.9,859.8 512.4,857.2 512.9,854.6 513.5,852.1 514.2,849.5 514.9,847.0 515.8,844.5 516.7,841.9 517.6,839.4 518.6,836.8 519.7,834.2 520.9,831.7 522.0,829.1 523.3,826.6 524.5,824.0 525.8,821.5 527.2,819.0 528.6,816.4 530.0,813.9 531.4,811.3 532.9,808.8 534.3,806.2 535.8,803.6 537.3,801.1 538.8,798.5 540.3,796.0 541.8,793.5 543.3,790.9 544.7,788.4 546.2,785.8 547.7,783.2 549.1,780.7 550.5,778.1 551.9,775.6 553.2,773.0 554.5,770.5 555.8,768.0 557.1,765.4 558.3,762.9 559.4,760.3 560.6,757.8 561.7,755.2 562.7,752.6 563.7,750.1 564.6,747.5 565.5,745.0 566.3,742.5 567.1,739.9 567.9,737.4 568.5,734.8 569.2,732.2 569.7,729.7 570.2,727.1 570.7,724.6 571.1,722.0 571.5,719.5 571.8,717.0 572.0,714.4 572.2,711.9 572.3,709.3 572.4,706.8 572.5,704.2 572.5,701.6 572.5,699.1 572.4,696.5 572.3,694.0 572.1,691.5 571.9,688.9 571.7,686.4 571.4,683.8 571.1,681.2 570.8,678.7 570.4,676.1 570.0,673.6 569.7,671.0 569.2,668.5 568.8,666.0 568.4,663.4 567.9,660.9 567.5,658.3 567.0,655.8 566.5,653.2 566.1,650.6 565.6,648.1 565.1,645.5 564.7,643.0 564.2,640.5 563.8,637.9 563.4,635.4 563.0,632.8 562.6,630.2 562.2,627.7 561.9,625.1 561.6,622.6 561.3,620.0 561.0,617.5 560.7,615.0 560.5,612.4 560.3,609.9 560.2,607.3 560.1,604.8 560.0,602.2 559.9,599.6 559.9,597.1 559.9,594.5 560.8,592.0" fill="url(#road)"/><polyline points="559.2,592.0 558.2,594.5 556.5,597.1 554.7,599.6 553.1,602.2 551.4,604.8 549.8,607.3 548.2,609.9 546.7,612.4 545.1,615.0 543.6,617.5 542.2,620.0 540.7,622.6 539.3,625.1 537.9,627.7 536.6,630.2 535.2,632.8 533.9,635.4 532.6,637.9 531.3,640.5 530.0,643.0 528.7,645.5 527.4,648.1 526.2,650.6 524.9,653.2 523.6,655.8 522.4,658.3 521.1,660.9 519.8,663.4 518.5,666.0 517.2,668.5 515.9,671.0 514.6,673.6 513.2,676.1 511.8,678.7 510.4,681.2 509.0,683.8 507.5,686.4 506.0,688.9 504.5,691.5 502.9,694.0 501.3,696.5 499.6,699.1 497.9,701.6 496.2,704.2 494.4,706.8 492.6,709.3 490.7,711.9 488.8,714.4 486.8,717.0 484.8,719.5 482.7,722.0 480.5,724.6 478.3,727.1 476.1,729.7 473.8,732.2 471.4,734.8 469.0,737.4 466.6,739.9 464.0,742.5 461.5,745.0 458.8,747.5 456.2,750.1 453.4,752.6 450.7,755.2 447.9,757.8 445.0,760.3 442.1,762.9 439.2,765.4 436.2,768.0 433.2,770.5 430.1,773.0 427.0,775.6 423.9,778.1 420.8,780.7 417.6,783.2 414.4,785.8 411.2,788.4 408.0,790.9 404.8,793.5 401.6,796.0 398.3,798.5 395.1,801.1 391.9,803.6 388.7,806.2 385.5,808.8 382.3,811.3 379.1,813.9 376.0,816.4 372.9,819.0 369.8,821.5 366.7,824.0 363.7,826.6 360.8,829.1 357.9,831.7 355.0,834.2 352.2,836.8 349.4,839.4 346.7,841.9 344.1,844.5 341.5,847.0 339.1,849.5 336.6,852.1 334.3,854.6 332.0,857.2 329.9,859.8 327.8,862.3 325.8,864.9 323.8,867.4 322.0,870.0 320.3,872.5 318.6,875.0 317.1,877.6 315.6,880.1 314.2,882.7 313.0,885.2 311.8,887.8 310.7,890.4 309.8,892.9 308.9,895.5 308.1,898.0 307.4,900.5 306.8,903.1 306.3,905.6 305.9,908.2 305.6,910.8 305.3,913.3 305.2,915.9 305.1,918.4 305.1,921.0 305.2,923.5 305.4,926.0 305.6,928.6 305.9,931.1 306.3,933.7 306.7,936.2 307.2,938.8 307.7,941.4 308.3,943.9 308.9,946.5 309.5,949.0 310.2,951.5 310.9,954.1 311.6,956.6 312.3,959.2 313.1,961.8 313.8,964.3 314.6,966.9 315.3,969.4 316.0,972.0 316.7,974.5 317.4,977.0 318.1,979.6 318.7,982.1 319.2,984.7 319.8,987.2 320.2,989.8 320.6,992.4 321.0,994.9 321.2,997.5 321.4,1000.0" fill="none" stroke="#FFFFF0" stroke-width="2.5" opacity=".75"/><polyline points="560.8,592.0 559.9,594.5 559.9,597.1 559.9,599.6 560.0,602.2 560.1,604.8 560.2,607.3 560.3,609.9 560.5,612.4 560.7,615.0 561.0,617.5 561.3,620.0 561.6,622.6 561.9,625.1 562.2,627.7 562.6,630.2 563.0,632.8 563.4,635.4 563.8,637.9 564.2,640.5 564.7,643.0 565.1,645.5 565.6,648.1 566.1,650.6 566.5,653.2 567.0,655.8 567.5,658.3 567.9,660.9 568.4,663.4 568.8,666.0 569.2,668.5 569.7,671.0 570.0,673.6 570.4,676.1 570.8,678.7 571.1,681.2 571.4,683.8 571.7,686.4 571.9,688.9 572.1,691.5 572.3,694.0 572.4,696.5 572.5,699.1 572.5,701.6 572.5,704.2 572.4,706.8 572.3,709.3 572.2,711.9 572.0,714.4 571.8,717.0 571.5,719.5 571.1,722.0 570.7,724.6 570.2,727.1 569.7,729.7 569.2,732.2 568.5,734.8 567.9,737.4 567.1,739.9 566.3,742.5 565.5,745.0 564.6,747.5 563.7,750.1 562.7,752.6 561.7,755.2 560.6,757.8 559.4,760.3 558.3,762.9 557.1,765.4 555.8,768.0 554.5,770.5 553.2,773.0 551.9,775.6 550.5,778.1 549.1,780.7 547.7,783.2 546.2,785.8 544.7,788.4 543.3,790.9 541.8,793.5 540.3,796.0 538.8,798.5 537.3,801.1 535.8,803.6 534.3,806.2 532.9,808.8 531.4,811.3 530.0,813.9 528.6,816.4 527.2,819.0 525.8,821.5 524.5,824.0 523.3,826.6 522.0,829.1 520.9,831.7 519.7,834.2 518.6,836.8 517.6,839.4 516.7,841.9 515.8,844.5 514.9,847.0 514.2,849.5 513.5,852.1 512.9,854.6 512.4,857.2 511.9,859.8 511.6,862.3 511.3,864.9 511.1,867.4 511.0,870.0 511.0,872.5 511.1,875.0 511.3,877.6 511.5,880.1 511.9,882.7 512.4,885.2 513.0,887.8 513.6,890.4 514.4,892.9 515.2,895.5 516.2,898.0 517.2,900.5 518.4,903.1 519.6,905.6 520.9,908.2 522.3,910.8 523.8,913.3 525.4,915.9 527.1,918.4 528.8,921.0 530.6,923.5 532.5,926.0 534.5,928.6 536.5,931.1 538.6,933.7 540.8,936.2 543.0,938.8 545.2,941.4 547.5,943.9 549.9,946.5 552.3,949.0 554.7,951.5 557.1,954.1 559.6,956.6 562.0,959.2 564.5,961.8 567.0,964.3 569.5,966.9 571.9,969.4 574.4,972.0 576.8,974.5 579.2,977.0 581.6,979.6 584.0,982.1 586.3,984.7 588.5,987.2 590.7,989.8 592.9,992.4 594.9,994.9 597.0,997.5 598.9,1000.0" fill="none" stroke="#FFFFF0" stroke-width="2.5" opacity=".75"/></g><path d="M-40 770 C100 735 230 750 300 790 C330 820 330 880 300 920 L-40 920Z" fill="url(#g3)"/><path d="M1640 760 C1000 730 650 745 590 790 C560 820 560 880 590 920 L1640 920Z" fill="url(#g3)"/><g filter="url(#soft)" opacity=".7"><ellipse cx="556" cy="594" rx="45" ry="6" fill="#E3F8DA"/></g><polygon points="508.0,558.5 502.2,568.9 508.0,568.9" fill="#86D8BE"/><polygon points="508.0,558.5 513.8,568.9 508.0,568.9" fill="#68C4AA"/><polygon points="508.0,563.7 500.4,574.1 508.0,574.1" fill="#86D8BE"/><polygon points="508.0,563.7 515.6,574.1 508.0,574.1" fill="#68C4AA"/><polygon points="508.0,568.9 498.7,579.4 508.0,579.4" fill="#86D8BE"/><polygon points="508.0,568.9 517.3,579.4 508.0,579.4" fill="#68C4AA"/><polygon points="508.0,574.1 496.9,584.6 508.0,584.6" fill="#86D8BE"/><polygon points="508.0,574.1 519.1,584.6 508.0,584.6" fill="#68C4AA"/><polygon points="508.0,579.4 495.1,589.8 508.0,589.8" fill="#86D8BE"/><polygon points="508.0,579.4 520.9,589.8 508.0,589.8" fill="#68C4AA"/><rect x="507.4" y="587.9" width="1.2" height="2.5" fill="#68C4AA"/><polygon points="524.0,565.5 519.5,573.6 524.0,573.6" fill="#86D8BE"/><polygon points="524.0,565.5 528.5,573.6 524.0,573.6" fill="#68C4AA"/><polygon points="524.0,569.6 518.1,577.7 524.0,577.7" fill="#86D8BE"/><polygon points="524.0,569.6 529.9,577.7 524.0,577.7" fill="#68C4AA"/><polygon points="524.0,573.6 516.7,581.7 524.0,581.7" fill="#86D8BE"/><polygon points="524.0,573.6 531.3,581.7 524.0,581.7" fill="#68C4AA"/><polygon points="524.0,577.7 515.4,585.8 524.0,585.8" fill="#86D8BE"/><polygon points="524.0,577.7 532.6,585.8 524.0,585.8" fill="#68C4AA"/><polygon points="524.0,581.7 514.0,589.8 524.0,589.8" fill="#86D8BE"/><polygon points="524.0,581.7 534.0,589.8 524.0,589.8" fill="#68C4AA"/><rect x="523.5" y="588.4" width="1.0" height="1.9" fill="#68C4AA"/><polygon points="596.0,564.5 590.3,574.8 596.0,574.8" fill="#86D8BE"/><polygon points="596.0,564.5 601.7,574.8 596.0,574.8" fill="#68C4AA"/><polygon points="596.0,569.7 588.6,579.9 596.0,579.9" fill="#86D8BE"/><polygon points="596.0,569.7 603.4,579.9 596.0,579.9" fill="#68C4AA"/><polygon points="596.0,574.8 586.8,585.1 596.0,585.1" fill="#86D8BE"/><polygon points="596.0,574.8 605.2,585.1 596.0,585.1" fill="#68C4AA"/><polygon points="596.0,579.9 585.1,590.2 596.0,590.2" fill="#86D8BE"/><polygon points="596.0,579.9 606.9,590.2 596.0,590.2" fill="#68C4AA"/><polygon points="596.0,585.1 583.3,595.3 596.0,595.3" fill="#86D8BE"/><polygon points="596.0,585.1 608.7,595.3 596.0,595.3" fill="#68C4AA"/><rect x="595.4" y="593.5" width="1.2" height="2.4" fill="#68C4AA"/><polygon points="610.0,566.9 605.6,574.9 610.0,574.9" fill="#86D8BE"/><polygon points="610.0,566.9 614.4,574.9 610.0,574.9" fill="#68C4AA"/><polygon points="610.0,570.9 604.2,578.9 610.0,578.9" fill="#86D8BE"/><polygon points="610.0,570.9 615.8,578.9 610.0,578.9" fill="#68C4AA"/><polygon points="610.0,574.9 602.9,582.9 610.0,582.9" fill="#86D8BE"/><polygon points="610.0,574.9 617.1,582.9 610.0,582.9" fill="#68C4AA"/><polygon points="610.0,578.9 601.5,586.8 610.0,586.8" fill="#86D8BE"/><polygon points="610.0,578.9 618.5,586.8 610.0,586.8" fill="#68C4AA"/><polygon points="610.0,582.9 600.2,590.8 610.0,590.8" fill="#86D8BE"/><polygon points="610.0,582.9 619.8,590.8 610.0,590.8" fill="#68C4AA"/><rect x="609.5" y="589.4" width="0.9" height="1.9" fill="#68C4AA"/><polygon points="36.3,672.7 18.3,705.2 36.3,705.2" fill="#1B8A7C"/><polygon points="36.3,672.7 54.4,705.2 36.3,705.2" fill="#136F73"/><polygon points="36.3,688.9 12.8,721.4 36.3,721.4" fill="#1B8A7C"/><polygon points="36.3,688.9 59.9,721.4 36.3,721.4" fill="#136F73"/><polygon points="36.3,705.2 7.3,737.6 36.3,737.6" fill="#1B8A7C"/><polygon points="36.3,705.2 65.4,737.6 36.3,737.6" fill="#136F73"/><polygon points="36.3,721.4 1.8,753.9 36.3,753.9" fill="#1B8A7C"/><polygon points="36.3,721.4 70.9,753.9 36.3,753.9" fill="#136F73"/><polygon points="36.3,737.6 -3.8,770.1 36.3,770.1" fill="#1B8A7C"/><polygon points="36.3,737.6 76.4,770.1 36.3,770.1" fill="#136F73"/><rect x="34.4" y="764.4" width="3.8" height="7.6" fill="#136F73"/><polygon points="61.1,659.4 39.2,698.8 61.1,698.8" fill="#1B8A7C"/><polygon points="61.1,659.4 83.0,698.8 61.1,698.8" fill="#136F73"/><polygon points="61.1,679.1 32.5,718.5 61.1,718.5" fill="#1B8A7C"/><polygon points="61.1,679.1 89.7,718.5 61.1,718.5" fill="#136F73"/><polygon points="61.1,698.8 25.8,738.2 61.1,738.2" fill="#1B8A7C"/><polygon points="61.1,698.8 96.4,738.2 61.1,738.2" fill="#136F73"/><polygon points="61.1,718.5 19.1,757.9 61.1,757.9" fill="#1B8A7C"/><polygon points="61.1,718.5 103.1,757.9 61.1,757.9" fill="#136F73"/><polygon points="61.1,738.2 12.4,777.6 61.1,777.6" fill="#1B8A7C"/><polygon points="61.1,738.2 109.8,777.6 61.1,777.6" fill="#136F73"/><rect x="58.8" y="770.7" width="4.6" height="9.3" fill="#136F73"/><polygon points="86.6,667.5 66.4,704.0 86.6,704.0" fill="#1B8A7C"/><polygon points="86.6,667.5 106.9,704.0 86.6,704.0" fill="#136F73"/><polygon points="86.6,685.8 60.2,722.3 86.6,722.3" fill="#1B8A7C"/><polygon points="86.6,685.8 113.1,722.3 86.6,722.3" fill="#136F73"/><polygon points="86.6,704.0 54.0,740.5 86.6,740.5" fill="#1B8A7C"/><polygon points="86.6,704.0 119.3,740.5 86.6,740.5" fill="#136F73"/><polygon points="86.6,722.3 47.8,758.8 86.6,758.8" fill="#1B8A7C"/><polygon points="86.6,722.3 125.5,758.8 86.6,758.8" fill="#136F73"/><polygon points="86.6,740.5 41.6,777.0 86.6,777.0" fill="#1B8A7C"/><polygon points="86.6,740.5 131.7,777.0 86.6,777.0" fill="#136F73"/><rect x="84.5" y="770.6" width="4.3" height="8.6" fill="#136F73"/><polygon points="90.7,664.9 69.7,702.6 90.7,702.6" fill="#1B8A7C"/><polygon points="90.7,664.9 111.6,702.6 90.7,702.6" fill="#136F73"/><polygon points="90.7,683.7 63.3,721.4 90.7,721.4" fill="#1B8A7C"/><polygon points="90.7,683.7 118.0,721.4 90.7,721.4" fill="#136F73"/><polygon points="90.7,702.6 56.9,740.2 90.7,740.2" fill="#1B8A7C"/><polygon points="90.7,702.6 124.4,740.2 90.7,740.2" fill="#136F73"/><polygon points="90.7,721.4 50.6,759.0 90.7,759.0" fill="#1B8A7C"/><polygon points="90.7,721.4 130.8,759.0 90.7,759.0" fill="#136F73"/><polygon points="90.7,740.2 44.2,777.8 90.7,777.8" fill="#1B8A7C"/><polygon points="90.7,740.2 137.1,777.8 90.7,777.8" fill="#136F73"/><rect x="88.4" y="771.2" width="4.4" height="8.9" fill="#136F73"/><polygon points="92.1,658.6 70.8,696.9 92.1,696.9" fill="#1B8A7C"/><polygon points="92.1,658.6 113.5,696.9 92.1,696.9" fill="#136F73"/><polygon points="92.1,677.7 64.3,716.1 92.1,716.1" fill="#1B8A7C"/><polygon points="92.1,677.7 120.0,716.1 92.1,716.1" fill="#136F73"/><polygon points="92.1,696.9 57.7,735.3 92.1,735.3" fill="#1B8A7C"/><polygon points="92.1,696.9 126.5,735.3 92.1,735.3" fill="#136F73"/><polygon points="92.1,716.1 51.2,754.5 92.1,754.5" fill="#1B8A7C"/><polygon points="92.1,716.1 133.0,754.5 92.1,754.5" fill="#136F73"/><polygon points="92.1,735.3 44.7,773.7 92.1,773.7" fill="#1B8A7C"/><polygon points="92.1,735.3 139.5,773.7 92.1,773.7" fill="#136F73"/><rect x="89.9" y="767.0" width="4.5" height="9.0" fill="#136F73"/><polygon points="159.6,668.0 139.6,704.0 159.6,704.0" fill="#1B8A7C"/><polygon points="159.6,668.0 179.6,704.0 159.6,704.0" fill="#136F73"/><polygon points="159.6,686.0 133.5,722.0 159.6,722.0" fill="#1B8A7C"/><polygon points="159.6,686.0 185.7,722.0 159.6,722.0" fill="#136F73"/><polygon points="159.6,704.0 127.4,740.0 159.6,740.0" fill="#1B8A7C"/><polygon points="159.6,704.0 191.8,740.0 159.6,740.0" fill="#136F73"/><polygon points="159.6,722.0 121.2,758.0 159.6,758.0" fill="#1B8A7C"/><polygon points="159.6,722.0 197.9,758.0 159.6,758.0" fill="#136F73"/><polygon points="159.6,740.0 115.1,776.0 159.6,776.0" fill="#1B8A7C"/><polygon points="159.6,740.0 204.0,776.0 159.6,776.0" fill="#136F73"/><rect x="157.5" y="769.6" width="4.2" height="8.5" fill="#136F73"/><polygon points="162.4,672.2 145.2,703.3 162.4,703.3" fill="#1B8A7C"/><polygon points="162.4,672.2 179.7,703.3 162.4,703.3" fill="#136F73"/><polygon points="162.4,687.8 139.9,718.8 162.4,718.8" fill="#1B8A7C"/><polygon points="162.4,687.8 185.0,718.8 162.4,718.8" fill="#136F73"/><polygon points="162.4,703.3 134.6,734.3 162.4,734.3" fill="#1B8A7C"/><polygon points="162.4,703.3 190.3,734.3 162.4,734.3" fill="#136F73"/><polygon points="162.4,718.8 129.4,749.9 162.4,749.9" fill="#1B8A7C"/><polygon points="162.4,718.8 195.5,749.9 162.4,749.9" fill="#136F73"/><polygon points="162.4,734.3 124.1,765.4 162.4,765.4" fill="#1B8A7C"/><polygon points="162.4,734.3 200.8,765.4 162.4,765.4" fill="#136F73"/><rect x="160.6" y="759.9" width="3.7" height="7.3" fill="#136F73"/><polygon points="172.9,673.7 155.6,704.8 172.9,704.8" fill="#1B8A7C"/><polygon points="172.9,673.7 190.2,704.8 172.9,704.8" fill="#136F73"/><polygon points="172.9,689.2 150.3,720.4 172.9,720.4" fill="#1B8A7C"/><polygon points="172.9,689.2 195.5,720.4 172.9,720.4" fill="#136F73"/><polygon points="172.9,704.8 145.0,735.9 172.9,735.9" fill="#1B8A7C"/><polygon points="172.9,704.8 200.8,735.9 172.9,735.9" fill="#136F73"/><polygon points="172.9,720.4 139.7,751.5 172.9,751.5" fill="#1B8A7C"/><polygon points="172.9,720.4 206.1,751.5 172.9,751.5" fill="#136F73"/><polygon points="172.9,735.9 134.5,767.1 172.9,767.1" fill="#1B8A7C"/><polygon points="172.9,735.9 211.4,767.1 172.9,767.1" fill="#136F73"/><rect x="171.1" y="761.6" width="3.7" height="7.3" fill="#136F73"/><polygon points="213.4,667.0 192.7,704.1 213.4,704.1" fill="#1B8A7C"/><polygon points="213.4,667.0 234.0,704.1 213.4,704.1" fill="#136F73"/><polygon points="213.4,685.6 186.4,722.7 213.4,722.7" fill="#1B8A7C"/><polygon points="213.4,685.6 240.3,722.7 213.4,722.7" fill="#136F73"/><polygon points="213.4,704.1 180.1,741.3 213.4,741.3" fill="#1B8A7C"/><polygon points="213.4,704.1 246.6,741.3 213.4,741.3" fill="#136F73"/><polygon points="213.4,722.7 173.8,759.8 213.4,759.8" fill="#1B8A7C"/><polygon points="213.4,722.7 252.9,759.8 213.4,759.8" fill="#136F73"/><polygon points="213.4,741.3 167.5,778.4 213.4,778.4" fill="#1B8A7C"/><polygon points="213.4,741.3 259.2,778.4 213.4,778.4" fill="#136F73"/><rect x="211.2" y="771.9" width="4.4" height="8.7" fill="#136F73"/><polygon points="252.9,684.1 235.9,714.8 252.9,714.8" fill="#1B8A7C"/><polygon points="252.9,684.1 269.9,714.8 252.9,714.8" fill="#136F73"/><polygon points="252.9,699.5 230.7,730.1 252.9,730.1" fill="#1B8A7C"/><polygon points="252.9,699.5 275.1,730.1 252.9,730.1" fill="#136F73"/><polygon points="252.9,714.8 225.5,745.4 252.9,745.4" fill="#1B8A7C"/><polygon points="252.9,714.8 280.3,745.4 252.9,745.4" fill="#136F73"/><polygon points="252.9,730.1 220.3,760.7 252.9,760.7" fill="#1B8A7C"/><polygon points="252.9,730.1 285.5,760.7 252.9,760.7" fill="#136F73"/><polygon points="252.9,745.4 215.1,776.0 252.9,776.0" fill="#1B8A7C"/><polygon points="252.9,745.4 290.7,776.0 252.9,776.0" fill="#136F73"/><rect x="251.1" y="770.6" width="3.6" height="7.2" fill="#136F73"/><polygon points="651.5,651.1 629.3,690.8 651.5,690.8" fill="#1B8A7C"/><polygon points="651.5,651.1 673.6,690.8 651.5,690.8" fill="#136F73"/><polygon points="651.5,670.9 622.6,710.7 651.5,710.7" fill="#1B8A7C"/><polygon points="651.5,670.9 680.3,710.7 651.5,710.7" fill="#136F73"/><polygon points="651.5,690.8 615.8,730.6 651.5,730.6" fill="#1B8A7C"/><polygon points="651.5,690.8 687.1,730.6 651.5,730.6" fill="#136F73"/><polygon points="651.5,710.7 609.1,750.5 651.5,750.5" fill="#1B8A7C"/><polygon points="651.5,710.7 693.8,750.5 651.5,750.5" fill="#136F73"/><polygon points="651.5,730.6 602.3,770.3 651.5,770.3" fill="#1B8A7C"/><polygon points="651.5,730.6 700.6,770.3 651.5,770.3" fill="#136F73"/><rect x="649.1" y="763.3" width="4.7" height="9.4" fill="#136F73"/><polygon points="717.8,636.7 693.6,680.2 717.8,680.2" fill="#1B8A7C"/><polygon points="717.8,636.7 741.9,680.2 717.8,680.2" fill="#136F73"/><polygon points="717.8,658.5 686.2,701.9 717.8,701.9" fill="#1B8A7C"/><polygon points="717.8,658.5 749.3,701.9 717.8,701.9" fill="#136F73"/><polygon points="717.8,680.2 678.8,723.6 717.8,723.6" fill="#1B8A7C"/><polygon points="717.8,680.2 756.7,723.6 717.8,723.6" fill="#136F73"/><polygon points="717.8,701.9 671.5,745.4 717.8,745.4" fill="#1B8A7C"/><polygon points="717.8,701.9 764.1,745.4 717.8,745.4" fill="#136F73"/><polygon points="717.8,723.6 664.1,767.1 717.8,767.1" fill="#1B8A7C"/><polygon points="717.8,723.6 771.4,767.1 717.8,767.1" fill="#136F73"/><rect x="715.2" y="759.4" width="5.1" height="10.2" fill="#136F73"/><polygon points="769.1,642.1 747.0,681.8 769.1,681.8" fill="#1B8A7C"/><polygon points="769.1,642.1 791.1,681.8 769.1,681.8" fill="#136F73"/><polygon points="769.1,662.0 740.3,701.7 769.1,701.7" fill="#1B8A7C"/><polygon points="769.1,662.0 797.9,701.7 769.1,701.7" fill="#136F73"/><polygon points="769.1,681.8 733.5,721.5 769.1,721.5" fill="#1B8A7C"/><polygon points="769.1,681.8 804.6,721.5 769.1,721.5" fill="#136F73"/><polygon points="769.1,701.7 726.8,741.4 769.1,741.4" fill="#1B8A7C"/><polygon points="769.1,701.7 811.4,741.4 769.1,741.4" fill="#136F73"/><polygon points="769.1,721.5 720.0,761.2 769.1,761.2" fill="#1B8A7C"/><polygon points="769.1,721.5 818.1,761.2 769.1,761.2" fill="#136F73"/><rect x="766.7" y="754.2" width="4.7" height="9.3" fill="#136F73"/><polygon points="771.6,644.7 749.5,684.5 771.6,684.5" fill="#1B8A7C"/><polygon points="771.6,644.7 793.7,684.5 771.6,684.5" fill="#136F73"/><polygon points="771.6,664.6 742.7,704.3 771.6,704.3" fill="#1B8A7C"/><polygon points="771.6,664.6 800.4,704.3 771.6,704.3" fill="#136F73"/><polygon points="771.6,684.5 736.0,724.2 771.6,724.2" fill="#1B8A7C"/><polygon points="771.6,684.5 807.2,724.2 771.6,724.2" fill="#136F73"/><polygon points="771.6,704.3 729.2,744.1 771.6,744.1" fill="#1B8A7C"/><polygon points="771.6,704.3 814.0,744.1 771.6,744.1" fill="#136F73"/><polygon points="771.6,724.2 722.4,764.0 771.6,764.0" fill="#1B8A7C"/><polygon points="771.6,724.2 820.7,764.0 771.6,764.0" fill="#136F73"/><rect x="769.2" y="757.0" width="4.7" height="9.4" fill="#136F73"/><polygon points="775.9,672.1 757.6,705.0 775.9,705.0" fill="#1B8A7C"/><polygon points="775.9,672.1 794.1,705.0 775.9,705.0" fill="#136F73"/><polygon points="775.9,688.5 752.0,721.4 775.9,721.4" fill="#1B8A7C"/><polygon points="775.9,688.5 799.7,721.4 775.9,721.4" fill="#136F73"/><polygon points="775.9,705.0 746.5,737.8 775.9,737.8" fill="#1B8A7C"/><polygon points="775.9,705.0 805.3,737.8 775.9,737.8" fill="#136F73"/><polygon points="775.9,721.4 740.9,754.2 775.9,754.2" fill="#1B8A7C"/><polygon points="775.9,721.4 810.8,754.2 775.9,754.2" fill="#136F73"/><polygon points="775.9,737.8 735.3,770.6 775.9,770.6" fill="#1B8A7C"/><polygon points="775.9,737.8 816.4,770.6 775.9,770.6" fill="#136F73"/><rect x="773.9" y="764.8" width="3.9" height="7.7" fill="#136F73"/><polygon points="778.3,669.2 761.1,700.2 778.3,700.2" fill="#1B8A7C"/><polygon points="778.3,669.2 795.5,700.2 778.3,700.2" fill="#136F73"/><polygon points="778.3,684.7 755.9,715.6 778.3,715.6" fill="#1B8A7C"/><polygon points="778.3,684.7 800.8,715.6 778.3,715.6" fill="#136F73"/><polygon points="778.3,700.2 750.6,731.1 778.3,731.1" fill="#1B8A7C"/><polygon points="778.3,700.2 806.0,731.1 778.3,731.1" fill="#136F73"/><polygon points="778.3,715.6 745.3,746.6 778.3,746.6" fill="#1B8A7C"/><polygon points="778.3,715.6 811.3,746.6 778.3,746.6" fill="#136F73"/><polygon points="778.3,731.1 740.1,762.0 778.3,762.0" fill="#1B8A7C"/><polygon points="778.3,731.1 816.5,762.0 778.3,762.0" fill="#136F73"/><rect x="776.5" y="756.6" width="3.6" height="7.3" fill="#136F73"/><polygon points="850.5,667.6 832.9,699.2 850.5,699.2" fill="#1B8A7C"/><polygon points="850.5,667.6 868.1,699.2 850.5,699.2" fill="#136F73"/><polygon points="850.5,683.4 827.5,715.1 850.5,715.1" fill="#1B8A7C"/><polygon points="850.5,683.4 873.4,715.1 850.5,715.1" fill="#136F73"/><polygon points="850.5,699.2 822.1,730.9 850.5,730.9" fill="#1B8A7C"/><polygon points="850.5,699.2 878.8,730.9 850.5,730.9" fill="#136F73"/><polygon points="850.5,715.1 816.7,746.7 850.5,746.7" fill="#1B8A7C"/><polygon points="850.5,715.1 884.2,746.7 850.5,746.7" fill="#136F73"/><polygon points="850.5,730.9 811.4,762.6 850.5,762.6" fill="#1B8A7C"/><polygon points="850.5,730.9 889.6,762.6 850.5,762.6" fill="#136F73"/><rect x="848.6" y="757.0" width="3.7" height="7.5" fill="#136F73"/><polygon points="869.0,634.5 844.6,678.3 869.0,678.3" fill="#1B8A7C"/><polygon points="869.0,634.5 893.4,678.3 869.0,678.3" fill="#136F73"/><polygon points="869.0,656.4 837.2,700.2 869.0,700.2" fill="#1B8A7C"/><polygon points="869.0,656.4 900.8,700.2 869.0,700.2" fill="#136F73"/><polygon points="869.0,678.3 829.7,722.2 869.0,722.2" fill="#1B8A7C"/><polygon points="869.0,678.3 908.2,722.2 869.0,722.2" fill="#136F73"/><polygon points="869.0,700.2 822.3,744.1 869.0,744.1" fill="#1B8A7C"/><polygon points="869.0,700.2 915.7,744.1 869.0,744.1" fill="#136F73"/><polygon points="869.0,722.2 814.8,766.0 869.0,766.0" fill="#1B8A7C"/><polygon points="869.0,722.2 923.1,766.0 869.0,766.0" fill="#136F73"/><rect x="866.4" y="758.3" width="5.2" height="10.3" fill="#136F73"/><polygon points="891.9,660.4 872.5,695.2 891.9,695.2" fill="#1B8A7C"/><polygon points="891.9,660.4 911.3,695.2 891.9,695.2" fill="#136F73"/><polygon points="891.9,677.8 866.6,712.6 891.9,712.6" fill="#1B8A7C"/><polygon points="891.9,677.8 917.2,712.6 891.9,712.6" fill="#136F73"/><polygon points="891.9,695.2 860.7,730.0 891.9,730.0" fill="#1B8A7C"/><polygon points="891.9,695.2 923.1,730.0 891.9,730.0" fill="#136F73"/><polygon points="891.9,712.6 854.8,747.5 891.9,747.5" fill="#1B8A7C"/><polygon points="891.9,712.6 929.0,747.5 891.9,747.5" fill="#136F73"/><polygon points="891.9,730.0 848.8,764.9 891.9,764.9" fill="#1B8A7C"/><polygon points="891.9,730.0 934.9,764.9 891.9,764.9" fill="#136F73"/><rect x="889.8" y="758.7" width="4.1" height="8.2" fill="#136F73"/><polygon points="901.3,663.2 882.2,697.6 901.3,697.6" fill="#1B8A7C"/><polygon points="901.3,663.2 920.5,697.6 901.3,697.6" fill="#136F73"/><polygon points="901.3,680.4 876.3,714.8 901.3,714.8" fill="#1B8A7C"/><polygon points="901.3,680.4 926.3,714.8 901.3,714.8" fill="#136F73"/><polygon points="901.3,697.6 870.5,732.1 901.3,732.1" fill="#1B8A7C"/><polygon points="901.3,697.6 932.2,732.1 901.3,732.1" fill="#136F73"/><polygon points="901.3,714.8 864.6,749.3 901.3,749.3" fill="#1B8A7C"/><polygon points="901.3,714.8 938.0,749.3 901.3,749.3" fill="#136F73"/><polygon points="901.3,732.1 858.8,766.5 901.3,766.5" fill="#1B8A7C"/><polygon points="901.3,732.1 943.9,766.5 901.3,766.5" fill="#136F73"/><rect x="899.3" y="760.4" width="4.1" height="8.1" fill="#136F73"/><polygon points="981.6,650.0 959.2,690.4 981.6,690.4" fill="#1B8A7C"/><polygon points="981.6,650.0 1004.0,690.4 981.6,690.4" fill="#136F73"/><polygon points="981.6,670.2 952.3,710.5 981.6,710.5" fill="#1B8A7C"/><polygon points="981.6,670.2 1010.9,710.5 981.6,710.5" fill="#136F73"/><polygon points="981.6,690.4 945.4,730.7 981.6,730.7" fill="#1B8A7C"/><polygon points="981.6,690.4 1017.7,730.7 981.6,730.7" fill="#136F73"/><polygon points="981.6,710.5 938.6,750.9 981.6,750.9" fill="#1B8A7C"/><polygon points="981.6,710.5 1024.6,750.9 981.6,750.9" fill="#136F73"/><polygon points="981.6,730.7 931.7,771.1 981.6,771.1" fill="#1B8A7C"/><polygon points="981.6,730.7 1031.4,771.1 981.6,771.1" fill="#136F73"/><rect x="979.2" y="764.0" width="4.7" height="9.5" fill="#136F73"/><polygon points="987.1,660.0 968.3,693.9 987.1,693.9" fill="#1B8A7C"/><polygon points="987.1,660.0 1006.0,693.9 987.1,693.9" fill="#136F73"/><polygon points="987.1,676.9 962.6,710.8 987.1,710.8" fill="#1B8A7C"/><polygon points="987.1,676.9 1011.7,710.8 987.1,710.8" fill="#136F73"/><polygon points="987.1,693.9 956.8,727.7 987.1,727.7" fill="#1B8A7C"/><polygon points="987.1,693.9 1017.5,727.7 987.1,727.7" fill="#136F73"/><polygon points="987.1,710.8 951.1,744.7 987.1,744.7" fill="#1B8A7C"/><polygon points="987.1,710.8 1023.2,744.7 987.1,744.7" fill="#136F73"/><polygon points="987.1,727.7 945.3,761.6 987.1,761.6" fill="#1B8A7C"/><polygon points="987.1,727.7 1029.0,761.6 987.1,761.6" fill="#136F73"/><rect x="985.1" y="755.6" width="4.0" height="8.0" fill="#136F73"/><polygon points="997.9,640.1 973.8,683.5 997.9,683.5" fill="#1B8A7C"/><polygon points="997.9,640.1 1022.1,683.5 997.9,683.5" fill="#136F73"/><polygon points="997.9,661.8 966.5,705.2 997.9,705.2" fill="#1B8A7C"/><polygon points="997.9,661.8 1029.4,705.2 997.9,705.2" fill="#136F73"/><polygon points="997.9,683.5 959.1,726.9 997.9,726.9" fill="#1B8A7C"/><polygon points="997.9,683.5 1036.8,726.9 997.9,726.9" fill="#136F73"/><polygon points="997.9,705.2 951.7,748.6 997.9,748.6" fill="#1B8A7C"/><polygon points="997.9,705.2 1044.2,748.6 997.9,748.6" fill="#136F73"/><polygon points="997.9,726.9 944.3,770.3 997.9,770.3" fill="#1B8A7C"/><polygon points="997.9,726.9 1051.5,770.3 997.9,770.3" fill="#136F73"/><rect x="995.4" y="762.7" width="5.1" height="10.2" fill="#136F73"/><polygon points="1040.1,660.1 1019.8,696.6 1040.1,696.6" fill="#1B8A7C"/><polygon points="1040.1,660.1 1060.3,696.6 1040.1,696.6" fill="#136F73"/><polygon points="1040.1,678.3 1013.6,714.8 1040.1,714.8" fill="#1B8A7C"/><polygon points="1040.1,678.3 1066.5,714.8 1040.1,714.8" fill="#136F73"/><polygon points="1040.1,696.6 1007.4,733.0 1040.1,733.0" fill="#1B8A7C"/><polygon points="1040.1,696.6 1072.7,733.0 1040.1,733.0" fill="#136F73"/><polygon points="1040.1,714.8 1001.2,751.3 1040.1,751.3" fill="#1B8A7C"/><polygon points="1040.1,714.8 1078.9,751.3 1040.1,751.3" fill="#136F73"/><polygon points="1040.1,733.0 995.0,769.5 1040.1,769.5" fill="#1B8A7C"/><polygon points="1040.1,733.0 1085.1,769.5 1040.1,769.5" fill="#136F73"/><rect x="1037.9" y="763.0" width="4.3" height="8.6" fill="#136F73"/><polygon points="1076.3,682.4 1059.2,713.0 1076.3,713.0" fill="#1B8A7C"/><polygon points="1076.3,682.4 1093.3,713.0 1076.3,713.0" fill="#136F73"/><polygon points="1076.3,697.7 1054.0,728.4 1076.3,728.4" fill="#1B8A7C"/><polygon points="1076.3,697.7 1098.5,728.4 1076.3,728.4" fill="#136F73"/><polygon points="1076.3,713.0 1048.8,743.7 1076.3,743.7" fill="#1B8A7C"/><polygon points="1076.3,713.0 1103.7,743.7 1076.3,743.7" fill="#136F73"/><polygon points="1076.3,728.4 1043.6,759.1 1076.3,759.1" fill="#1B8A7C"/><polygon points="1076.3,728.4 1109.0,759.1 1076.3,759.1" fill="#136F73"/><polygon points="1076.3,743.7 1038.4,774.4 1076.3,774.4" fill="#1B8A7C"/><polygon points="1076.3,743.7 1114.2,774.4 1076.3,774.4" fill="#136F73"/><rect x="1074.5" y="769.0" width="3.6" height="7.2" fill="#136F73"/><polygon points="1080.8,636.8 1057.9,678.0 1080.8,678.0" fill="#1B8A7C"/><polygon points="1080.8,636.8 1103.7,678.0 1080.8,678.0" fill="#136F73"/><polygon points="1080.8,657.4 1050.9,698.6 1080.8,698.6" fill="#1B8A7C"/><polygon points="1080.8,657.4 1110.7,698.6 1080.8,698.6" fill="#136F73"/><polygon points="1080.8,678.0 1043.9,719.2 1080.8,719.2" fill="#1B8A7C"/><polygon points="1080.8,678.0 1117.7,719.2 1080.8,719.2" fill="#136F73"/><polygon points="1080.8,698.6 1036.9,739.8 1080.8,739.8" fill="#1B8A7C"/><polygon points="1080.8,698.6 1124.7,739.8 1080.8,739.8" fill="#136F73"/><polygon points="1080.8,719.2 1029.9,760.4 1080.8,760.4" fill="#1B8A7C"/><polygon points="1080.8,719.2 1131.7,760.4 1080.8,760.4" fill="#136F73"/><rect x="1078.4" y="753.1" width="4.8" height="9.7" fill="#136F73"/><polygon points="1092.4,671.8 1075.0,703.0 1092.4,703.0" fill="#1B8A7C"/><polygon points="1092.4,671.8 1109.7,703.0 1092.4,703.0" fill="#136F73"/><polygon points="1092.4,687.4 1069.7,718.6 1092.4,718.6" fill="#1B8A7C"/><polygon points="1092.4,687.4 1115.0,718.6 1092.4,718.6" fill="#136F73"/><polygon points="1092.4,703.0 1064.4,734.2 1092.4,734.2" fill="#1B8A7C"/><polygon points="1092.4,703.0 1120.3,734.2 1092.4,734.2" fill="#136F73"/><polygon points="1092.4,718.6 1059.1,749.8 1092.4,749.8" fill="#1B8A7C"/><polygon points="1092.4,718.6 1125.6,749.8 1092.4,749.8" fill="#136F73"/><polygon points="1092.4,734.2 1053.8,765.4 1092.4,765.4" fill="#1B8A7C"/><polygon points="1092.4,734.2 1131.0,765.4 1092.4,765.4" fill="#136F73"/><rect x="1090.6" y="759.9" width="3.7" height="7.3" fill="#136F73"/><polygon points="1227.1,636.2 1202.6,680.2 1227.1,680.2" fill="#1B8A7C"/><polygon points="1227.1,636.2 1251.6,680.2 1227.1,680.2" fill="#136F73"/><polygon points="1227.1,658.2 1195.1,702.3 1227.1,702.3" fill="#1B8A7C"/><polygon points="1227.1,658.2 1259.1,702.3 1227.1,702.3" fill="#136F73"/><polygon points="1227.1,680.2 1187.6,724.3 1227.1,724.3" fill="#1B8A7C"/><polygon points="1227.1,680.2 1266.5,724.3 1227.1,724.3" fill="#136F73"/><polygon points="1227.1,702.3 1180.1,746.3 1227.1,746.3" fill="#1B8A7C"/><polygon points="1227.1,702.3 1274.0,746.3 1227.1,746.3" fill="#136F73"/><polygon points="1227.1,724.3 1172.7,768.4 1227.1,768.4" fill="#1B8A7C"/><polygon points="1227.1,724.3 1281.5,768.4 1227.1,768.4" fill="#136F73"/><rect x="1224.5" y="760.6" width="5.2" height="10.4" fill="#136F73"/><polygon points="1482.7,661.3 1463.1,696.7 1482.7,696.7" fill="#1B8A7C"/><polygon points="1482.7,661.3 1502.4,696.7 1482.7,696.7" fill="#136F73"/><polygon points="1482.7,679.0 1457.1,714.3 1482.7,714.3" fill="#1B8A7C"/><polygon points="1482.7,679.0 1508.4,714.3 1482.7,714.3" fill="#136F73"/><polygon points="1482.7,696.7 1451.1,732.0 1482.7,732.0" fill="#1B8A7C"/><polygon points="1482.7,696.7 1514.4,732.0 1482.7,732.0" fill="#136F73"/><polygon points="1482.7,714.3 1445.1,749.7 1482.7,749.7" fill="#1B8A7C"/><polygon points="1482.7,714.3 1520.4,749.7 1482.7,749.7" fill="#136F73"/><polygon points="1482.7,732.0 1439.1,767.4 1482.7,767.4" fill="#1B8A7C"/><polygon points="1482.7,732.0 1526.4,767.4 1482.7,767.4" fill="#136F73"/><rect x="1480.7" y="761.1" width="4.2" height="8.3" fill="#136F73"/><polygon points="1492.0,665.7 1474.4,697.2 1492.0,697.2" fill="#1B8A7C"/><polygon points="1492.0,665.7 1509.5,697.2 1492.0,697.2" fill="#136F73"/><polygon points="1492.0,681.4 1469.1,713.0 1492.0,713.0" fill="#1B8A7C"/><polygon points="1492.0,681.4 1514.9,713.0 1492.0,713.0" fill="#136F73"/><polygon points="1492.0,697.2 1463.7,728.8 1492.0,728.8" fill="#1B8A7C"/><polygon points="1492.0,697.2 1520.3,728.8 1492.0,728.8" fill="#136F73"/><polygon points="1492.0,713.0 1458.3,744.6 1492.0,744.6" fill="#1B8A7C"/><polygon points="1492.0,713.0 1525.6,744.6 1492.0,744.6" fill="#136F73"/><polygon points="1492.0,728.8 1453.0,760.4 1492.0,760.4" fill="#1B8A7C"/><polygon points="1492.0,728.8 1531.0,760.4 1492.0,760.4" fill="#136F73"/><rect x="1490.1" y="754.8" width="3.7" height="7.4" fill="#136F73"/><polygon points="1526.0,661.7 1505.3,699.0 1526.0,699.0" fill="#1B8A7C"/><polygon points="1526.0,661.7 1546.8,699.0 1526.0,699.0" fill="#136F73"/><polygon points="1526.0,680.4 1499.0,717.7 1526.0,717.7" fill="#1B8A7C"/><polygon points="1526.0,680.4 1553.1,717.7 1526.0,717.7" fill="#136F73"/><polygon points="1526.0,699.0 1492.6,736.3 1526.0,736.3" fill="#1B8A7C"/><polygon points="1526.0,699.0 1559.4,736.3 1526.0,736.3" fill="#136F73"/><polygon points="1526.0,717.7 1486.3,754.9 1526.0,754.9" fill="#1B8A7C"/><polygon points="1526.0,717.7 1565.7,754.9 1526.0,754.9" fill="#136F73"/><polygon points="1526.0,736.3 1480.0,773.6 1526.0,773.6" fill="#1B8A7C"/><polygon points="1526.0,736.3 1572.1,773.6 1526.0,773.6" fill="#136F73"/><rect x="1523.8" y="767.0" width="4.4" height="8.8" fill="#136F73"/><polygon points="1539.2,679.8 1521.8,711.2 1539.2,711.2" fill="#1B8A7C"/><polygon points="1539.2,679.8 1556.6,711.2 1539.2,711.2" fill="#136F73"/><polygon points="1539.2,695.5 1516.4,726.8 1539.2,726.8" fill="#1B8A7C"/><polygon points="1539.2,695.5 1561.9,726.8 1539.2,726.8" fill="#136F73"/><polygon points="1539.2,711.2 1511.1,742.5 1539.2,742.5" fill="#1B8A7C"/><polygon points="1539.2,711.2 1567.2,742.5 1539.2,742.5" fill="#136F73"/><polygon points="1539.2,726.8 1505.8,758.1 1539.2,758.1" fill="#1B8A7C"/><polygon points="1539.2,726.8 1572.6,758.1 1539.2,758.1" fill="#136F73"/><polygon points="1539.2,742.5 1500.5,773.8 1539.2,773.8" fill="#1B8A7C"/><polygon points="1539.2,742.5 1577.9,773.8 1539.2,773.8" fill="#136F73"/><rect x="1537.3" y="768.3" width="3.7" height="7.4" fill="#136F73"/><path d="M-40 840 C60 795 170 800 235 850 C255 880 255 900 245 920 L-40 920Z" fill="url(#g4)"/><path d="M1640 830 C900 795 790 805 705 860 C690 880 690 900 705 920 L1640 920Z" fill="url(#g4)"/><polygon points="0.6,1482.8 -28.5,1535.2 0.6,1535.2" fill="#0E5560"/><polygon points="0.6,1482.8 29.7,1535.2 0.6,1535.2" fill="#093F4F"/><polygon points="0.6,1509.0 -37.4,1561.4 0.6,1561.4" fill="#0E5560"/><polygon points="0.6,1509.0 38.6,1561.4 0.6,1561.4" fill="#093F4F"/><polygon points="0.6,1535.2 -46.3,1587.6 0.6,1587.6" fill="#0E5560"/><polygon points="0.6,1535.2 47.5,1587.6 0.6,1587.6" fill="#093F4F"/><polygon points="0.6,1561.4 -55.2,1613.8 0.6,1613.8" fill="#0E5560"/><polygon points="0.6,1561.4 56.4,1613.8 0.6,1613.8" fill="#093F4F"/><polygon points="0.6,1587.6 -64.1,1640.0 0.6,1640.0" fill="#0E5560"/><polygon points="0.6,1587.6 65.3,1640.0 0.6,1640.0" fill="#093F4F"/><rect x="-2.5" y="1630.7" width="6.2" height="12.3" fill="#093F4F"/><polygon points="2.6,1404.9 -40.4,1482.3 2.6,1482.3" fill="#0E5560"/><polygon points="2.6,1404.9 45.7,1482.3 2.6,1482.3" fill="#093F4F"/><polygon points="2.6,1443.6 -53.6,1521.0 2.6,1521.0" fill="#0E5560"/><polygon points="2.6,1443.6 58.8,1521.0 2.6,1521.0" fill="#093F4F"/><polygon points="2.6,1482.3 -66.7,1559.7 2.6,1559.7" fill="#0E5560"/><polygon points="2.6,1482.3 72.0,1559.7 2.6,1559.7" fill="#093F4F"/><polygon points="2.6,1521.0 -79.9,1598.4 2.6,1598.4" fill="#0E5560"/><polygon points="2.6,1521.0 85.1,1598.4 2.6,1598.4" fill="#093F4F"/><polygon points="2.6,1559.7 -93.0,1637.2 2.6,1637.2" fill="#0E5560"/><polygon points="2.6,1559.7 98.3,1637.2 2.6,1637.2" fill="#093F4F"/><rect x="-1.9" y="1623.5" width="9.1" height="18.2" fill="#093F4F"/><polygon points="41.1,1444.2 5.1,1509.0 41.1,1509.0" fill="#0E5560"/><polygon points="41.1,1444.2 77.2,1509.0 41.1,1509.0" fill="#093F4F"/><polygon points="41.1,1476.6 -5.9,1541.4 41.1,1541.4" fill="#0E5560"/><polygon points="41.1,1476.6 88.2,1541.4 41.1,1541.4" fill="#093F4F"/><polygon points="41.1,1509.0 -16.9,1573.8 41.1,1573.8" fill="#0E5560"/><polygon points="41.1,1509.0 99.2,1573.8 41.1,1573.8" fill="#093F4F"/><polygon points="41.1,1541.4 -28.0,1606.3 41.1,1606.3" fill="#0E5560"/><polygon points="41.1,1541.4 110.2,1606.3 41.1,1606.3" fill="#093F4F"/><polygon points="41.1,1573.8 -39.0,1638.7 41.1,1638.7" fill="#0E5560"/><polygon points="41.1,1573.8 121.2,1638.7 41.1,1638.7" fill="#093F4F"/><rect x="37.3" y="1627.2" width="7.6" height="15.3" fill="#093F4F"/><polygon points="43.6,1445.9 7.3,1511.4 43.6,1511.4" fill="#0E5560"/><polygon points="43.6,1445.9 80.0,1511.4 43.6,1511.4" fill="#093F4F"/><polygon points="43.6,1478.7 -3.9,1544.1 43.6,1544.1" fill="#0E5560"/><polygon points="43.6,1478.7 91.1,1544.1 43.6,1544.1" fill="#093F4F"/><polygon points="43.6,1511.4 -15.0,1576.8 43.6,1576.8" fill="#0E5560"/><polygon points="43.6,1511.4 102.3,1576.8 43.6,1576.8" fill="#093F4F"/><polygon points="43.6,1544.1 -26.1,1609.6 43.6,1609.6" fill="#0E5560"/><polygon points="43.6,1544.1 113.4,1609.6 43.6,1609.6" fill="#093F4F"/><polygon points="43.6,1576.8 -37.2,1642.3 43.6,1642.3" fill="#0E5560"/><polygon points="43.6,1576.8 124.5,1642.3 43.6,1642.3" fill="#093F4F"/><rect x="39.8" y="1630.7" width="7.7" height="15.4" fill="#093F4F"/><polygon points="73.4,1458.2 40.3,1517.8 73.4,1517.8" fill="#0E5560"/><polygon points="73.4,1458.2 106.5,1517.8 73.4,1517.8" fill="#093F4F"/><polygon points="73.4,1488.0 30.2,1547.5 73.4,1547.5" fill="#0E5560"/><polygon points="73.4,1488.0 116.6,1547.5 73.4,1547.5" fill="#093F4F"/><polygon points="73.4,1517.8 20.1,1577.3 73.4,1577.3" fill="#0E5560"/><polygon points="73.4,1517.8 126.8,1577.3 73.4,1577.3" fill="#093F4F"/><polygon points="73.4,1547.5 10.0,1607.1 73.4,1607.1" fill="#0E5560"/><polygon points="73.4,1547.5 136.9,1607.1 73.4,1607.1" fill="#093F4F"/><polygon points="73.4,1577.3 -0.1,1636.9 73.4,1636.9" fill="#0E5560"/><polygon points="73.4,1577.3 147.0,1636.9 73.4,1636.9" fill="#093F4F"/><rect x="69.9" y="1626.3" width="7.0" height="14.0" fill="#093F4F"/><polygon points="75.6,1440.4 39.0,1506.1 75.6,1506.1" fill="#0E5560"/><polygon points="75.6,1440.4 112.1,1506.1 75.6,1506.1" fill="#093F4F"/><polygon points="75.6,1473.2 27.9,1539.0 75.6,1539.0" fill="#0E5560"/><polygon points="75.6,1473.2 123.3,1539.0 75.6,1539.0" fill="#093F4F"/><polygon points="75.6,1506.1 16.7,1571.9 75.6,1571.9" fill="#0E5560"/><polygon points="75.6,1506.1 134.4,1571.9 75.6,1571.9" fill="#093F4F"/><polygon points="75.6,1539.0 5.5,1604.7 75.6,1604.7" fill="#0E5560"/><polygon points="75.6,1539.0 145.6,1604.7 75.6,1604.7" fill="#093F4F"/><polygon points="75.6,1571.9 -5.6,1637.6 75.6,1637.6" fill="#0E5560"/><polygon points="75.6,1571.9 156.8,1637.6 75.6,1637.6" fill="#093F4F"/><rect x="71.7" y="1626.0" width="7.7" height="15.5" fill="#093F4F"/><polygon points="715.7,673.8 678.9,740.1 715.7,740.1" fill="#0E5560"/><polygon points="715.7,673.8 752.5,740.1 715.7,740.1" fill="#093F4F"/><polygon points="715.7,706.9 667.6,773.2 715.7,773.2" fill="#0E5560"/><polygon points="715.7,706.9 763.7,773.2 715.7,773.2" fill="#093F4F"/><polygon points="715.7,740.1 656.4,806.3 715.7,806.3" fill="#0E5560"/><polygon points="715.7,740.1 775.0,806.3 715.7,806.3" fill="#093F4F"/><polygon points="715.7,773.2 645.1,839.4 715.7,839.4" fill="#0E5560"/><polygon points="715.7,773.2 786.2,839.4 715.7,839.4" fill="#093F4F"/><polygon points="715.7,806.3 633.9,872.5 715.7,872.5" fill="#0E5560"/><polygon points="715.7,806.3 797.5,872.5 715.7,872.5" fill="#093F4F"/><rect x="711.8" y="860.8" width="7.8" height="15.6" fill="#093F4F"/><polygon points="893.0,695.0 861.4,751.7 893.0,751.7" fill="#0E5560"/><polygon points="893.0,695.0 924.5,751.7 893.0,751.7" fill="#093F4F"/><polygon points="893.0,723.4 851.8,780.1 893.0,780.1" fill="#0E5560"/><polygon points="893.0,723.4 934.2,780.1 893.0,780.1" fill="#093F4F"/><polygon points="893.0,751.7 842.1,808.5 893.0,808.5" fill="#0E5560"/><polygon points="893.0,751.7 943.8,808.5 893.0,808.5" fill="#093F4F"/><polygon points="893.0,780.1 832.5,836.9 893.0,836.9" fill="#0E5560"/><polygon points="893.0,780.1 953.4,836.9 893.0,836.9" fill="#093F4F"/><polygon points="893.0,808.5 822.9,865.3 893.0,865.3" fill="#0E5560"/><polygon points="893.0,808.5 963.1,865.3 893.0,865.3" fill="#093F4F"/><rect x="889.6" y="855.2" width="6.7" height="13.4" fill="#093F4F"/><polygon points="1039.0,716.8 1010.0,769.0 1039.0,769.0" fill="#0E5560"/><polygon points="1039.0,716.8 1068.0,769.0 1039.0,769.0" fill="#093F4F"/><polygon points="1039.0,742.9 1001.1,795.0 1039.0,795.0" fill="#0E5560"/><polygon points="1039.0,742.9 1076.8,795.0 1039.0,795.0" fill="#093F4F"/><polygon points="1039.0,769.0 992.2,821.1 1039.0,821.1" fill="#0E5560"/><polygon points="1039.0,769.0 1085.7,821.1 1039.0,821.1" fill="#093F4F"/><polygon points="1039.0,795.0 983.4,847.2 1039.0,847.2" fill="#0E5560"/><polygon points="1039.0,795.0 1094.5,847.2 1039.0,847.2" fill="#093F4F"/><polygon points="1039.0,821.1 974.5,873.3 1039.0,873.3" fill="#0E5560"/><polygon points="1039.0,821.1 1103.4,873.3 1039.0,873.3" fill="#093F4F"/><rect x="1035.9" y="864.1" width="6.1" height="12.3" fill="#093F4F"/><polygon points="1137.9,700.1 1107.9,754.1 1137.9,754.1" fill="#0E5560"/><polygon points="1137.9,700.1 1167.9,754.1 1137.9,754.1" fill="#093F4F"/><polygon points="1137.9,727.1 1098.7,781.1 1137.9,781.1" fill="#0E5560"/><polygon points="1137.9,727.1 1177.0,781.1 1137.9,781.1" fill="#093F4F"/><polygon points="1137.9,754.1 1089.6,808.1 1137.9,808.1" fill="#0E5560"/><polygon points="1137.9,754.1 1186.2,808.1 1137.9,808.1" fill="#093F4F"/><polygon points="1137.9,781.1 1080.4,835.0 1137.9,835.0" fill="#0E5560"/><polygon points="1137.9,781.1 1195.4,835.0 1137.9,835.0" fill="#093F4F"/><polygon points="1137.9,808.1 1071.2,862.0 1137.9,862.0" fill="#0E5560"/><polygon points="1137.9,808.1 1204.5,862.0 1137.9,862.0" fill="#093F4F"/><rect x="1134.7" y="852.5" width="6.3" height="12.7" fill="#093F4F"/><polygon points="1185.7,672.1 1150.5,735.4 1185.7,735.4" fill="#0E5560"/><polygon points="1185.7,672.1 1220.9,735.4 1185.7,735.4" fill="#093F4F"/><polygon points="1185.7,703.7 1139.7,767.1 1185.7,767.1" fill="#0E5560"/><polygon points="1185.7,703.7 1231.7,767.1 1185.7,767.1" fill="#093F4F"/><polygon points="1185.7,735.4 1128.9,798.8 1185.7,798.8" fill="#0E5560"/><polygon points="1185.7,735.4 1242.4,798.8 1185.7,798.8" fill="#093F4F"/><polygon points="1185.7,767.1 1118.2,830.5 1185.7,830.5" fill="#0E5560"/><polygon points="1185.7,767.1 1253.2,830.5 1185.7,830.5" fill="#093F4F"/><polygon points="1185.7,798.8 1107.4,862.1 1185.7,862.1" fill="#0E5560"/><polygon points="1185.7,798.8 1263.9,862.1 1185.7,862.1" fill="#093F4F"/><rect x="1181.9" y="850.9" width="7.5" height="14.9" fill="#093F4F"/><polygon points="1214.3,711.3 1184.3,765.3 1214.3,765.3" fill="#0E5560"/><polygon points="1214.3,711.3 1244.3,765.3 1214.3,765.3" fill="#093F4F"/><polygon points="1214.3,738.3 1175.1,792.3 1214.3,792.3" fill="#0E5560"/><polygon points="1214.3,738.3 1253.5,792.3 1214.3,792.3" fill="#093F4F"/><polygon points="1214.3,765.3 1165.9,819.3 1214.3,819.3" fill="#0E5560"/><polygon points="1214.3,765.3 1262.6,819.3 1214.3,819.3" fill="#093F4F"/><polygon points="1214.3,792.3 1156.8,846.3 1214.3,846.3" fill="#0E5560"/><polygon points="1214.3,792.3 1271.8,846.3 1214.3,846.3" fill="#093F4F"/><polygon points="1214.3,819.3 1147.6,873.3 1214.3,873.3" fill="#0E5560"/><polygon points="1214.3,819.3 1281.0,873.3 1214.3,873.3" fill="#093F4F"/><rect x="1211.1" y="863.8" width="6.4" height="12.7" fill="#093F4F"/><polygon points="1238.5,714.2 1211.1,763.4 1238.5,763.4" fill="#0E5560"/><polygon points="1238.5,714.2 1265.8,763.4 1238.5,763.4" fill="#093F4F"/><polygon points="1238.5,738.8 1202.7,788.1 1238.5,788.1" fill="#0E5560"/><polygon points="1238.5,738.8 1274.2,788.1 1238.5,788.1" fill="#093F4F"/><polygon points="1238.5,763.4 1194.3,812.7 1238.5,812.7" fill="#0E5560"/><polygon points="1238.5,763.4 1282.6,812.7 1238.5,812.7" fill="#093F4F"/><polygon points="1238.5,788.1 1186.0,837.3 1238.5,837.3" fill="#0E5560"/><polygon points="1238.5,788.1 1291.0,837.3 1238.5,837.3" fill="#093F4F"/><polygon points="1238.5,812.7 1177.6,862.0 1238.5,862.0" fill="#0E5560"/><polygon points="1238.5,812.7 1299.3,862.0 1238.5,862.0" fill="#093F4F"/><rect x="1235.6" y="853.3" width="5.8" height="11.6" fill="#093F4F"/><polygon points="1262.6,715.9 1235.2,765.2 1262.6,765.2" fill="#0E5560"/><polygon points="1262.6,715.9 1290.0,765.2 1262.6,765.2" fill="#093F4F"/><polygon points="1262.6,740.5 1226.8,789.8 1262.6,789.8" fill="#0E5560"/><polygon points="1262.6,740.5 1298.4,789.8 1262.6,789.8" fill="#093F4F"/><polygon points="1262.6,765.2 1218.4,814.5 1262.6,814.5" fill="#0E5560"/><polygon points="1262.6,765.2 1306.8,814.5 1262.6,814.5" fill="#093F4F"/><polygon points="1262.6,789.8 1210.0,839.2 1262.6,839.2" fill="#0E5560"/><polygon points="1262.6,789.8 1315.1,839.2 1262.6,839.2" fill="#093F4F"/><polygon points="1262.6,814.5 1201.7,863.8 1262.6,863.8" fill="#0E5560"/><polygon points="1262.6,814.5 1323.5,863.8 1262.6,863.8" fill="#093F4F"/><rect x="1259.7" y="855.1" width="5.8" height="11.6" fill="#093F4F"/><polygon points="1471.1,689.2 1438.1,748.6 1471.1,748.6" fill="#0E5560"/><polygon points="1471.1,689.2 1504.1,748.6 1471.1,748.6" fill="#093F4F"/><polygon points="1471.1,718.9 1428.0,778.3 1471.1,778.3" fill="#0E5560"/><polygon points="1471.1,718.9 1514.2,778.3 1471.1,778.3" fill="#093F4F"/><polygon points="1471.1,748.6 1417.9,808.0 1471.1,808.0" fill="#0E5560"/><polygon points="1471.1,748.6 1524.3,808.0 1471.1,808.0" fill="#093F4F"/><polygon points="1471.1,778.3 1407.8,837.7 1471.1,837.7" fill="#0E5560"/><polygon points="1471.1,778.3 1534.3,837.7 1471.1,837.7" fill="#093F4F"/><polygon points="1471.1,808.0 1397.8,867.4 1471.1,867.4" fill="#0E5560"/><polygon points="1471.1,808.0 1544.4,867.4 1471.1,867.4" fill="#093F4F"/><rect x="1467.6" y="856.9" width="7.0" height="14.0" fill="#093F4F"/><polygon points="1529.2,717.2 1502.0,766.1 1529.2,766.1" fill="#0E5560"/><polygon points="1529.2,717.2 1556.3,766.1 1529.2,766.1" fill="#093F4F"/><polygon points="1529.2,741.7 1493.7,790.5 1529.2,790.5" fill="#0E5560"/><polygon points="1529.2,741.7 1564.6,790.5 1529.2,790.5" fill="#093F4F"/><polygon points="1529.2,766.1 1485.4,814.9 1529.2,814.9" fill="#0E5560"/><polygon points="1529.2,766.1 1572.9,814.9 1529.2,814.9" fill="#093F4F"/><polygon points="1529.2,790.5 1477.1,839.4 1529.2,839.4" fill="#0E5560"/><polygon points="1529.2,790.5 1581.2,839.4 1529.2,839.4" fill="#093F4F"/><polygon points="1529.2,814.9 1468.8,863.8 1529.2,863.8" fill="#0E5560"/><polygon points="1529.2,814.9 1589.5,863.8 1529.2,863.8" fill="#093F4F"/><rect x="1526.3" y="855.2" width="5.7" height="11.5" fill="#093F4F"/><g transform="translate(544.6469977404711 660) scale(0.7)"><ellipse cx="0" cy="2" rx="10" ry="3.5" fill="#0f4b52" opacity=".3"/><path d="M0 0 C-18 -20 -18 -44 0 -44 C18 -44 18 -20 0 0Z" fill="#2FBF8A"/><circle cx="0" cy="-28" r="6.5" fill="#fff"/></g><g transform="translate(522.7360920181479 730) scale(0.7)"><ellipse cx="0" cy="2" rx="10" ry="3.5" fill="#0f4b52" opacity=".3"/><path d="M0 0 C-18 -20 -18 -44 0 -44 C18 -44 18 -20 0 0Z" fill="#F2644A"/><circle cx="0" cy="-28" r="6.5" fill="#fff"/></g><g transform="translate(458.0296794690402 810) scale(0.7)"><ellipse cx="0" cy="2" rx="10" ry="3.5" fill="#0f4b52" opacity=".3"/><path d="M0 0 C-18 -20 -18 -44 0 -44 C18 -44 18 -20 0 0Z" fill="#F5A623"/><circle cx="0" cy="-28" r="6.5" fill="#fff"/></g><rect width="1600" height="900" filter="url(#grain)" style="mix-blend-mode:multiply" opacity=".6"/></svg>`;

const HERO_WAVE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><path d="M100 0 L100 100 L52 100 C22 86 44 72 46 56 C48 38 14 26 30 0 Z" fill="#FFFFFF"/></svg>';

function HeroMap() {
  return React.createElement('div', {
    style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    dangerouslySetInnerHTML: { __html: HERO_SCENE_SVG },
  });
}

export default function LoginScreen() {
  const { width: winWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && winWidth >= 900;
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  /* =====================================================
     EMAIL VALIDATION
     ===================================================== */

  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const isEmailFormatValid =
    email.length === 0 || emailRegex.test(email);

  /* =====================================================
     LOGIN
     ===================================================== */

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');

    let hasError = false;

    /* ตรวจสอบ Email */
    if (!email.trim()) {
      setEmailError('กรุณากรอกอีเมล');
      hasError = true;
    } else if (!emailRegex.test(email)) {
      setEmailError('รูปแบบอีเมลไม่ถูกต้อง');
      hasError = true;
    }

    /* ตรวจสอบ Password */
    if (!password.trim()) {
      setPasswordError('กรุณากรอกรหัสผ่าน');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('====================================');
      console.log('LOGIN');
      console.log('API URL:', API_URL);
      console.log('EMAIL:', email);
      console.log('====================================');

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      console.log('LOGIN STATUS:', response.status);
      console.log(
        'LOGIN RESPONSE:',
        JSON.stringify(data)
      );

      /* =================================================
         LOGIN SUCCESS
         ================================================= */

      if (response.ok) {
        // จำ user_id ไว้ ใช้ตอนบันทึก/ดูแผนที่ที่เซฟไว้
        if (typeof data?.user_id === 'number') {
          await saveSession({
            userId: data.user_id,
            name: data?.name,
            email: data?.email,
            token: data?.token,
            isAdmin: data?.is_admin === true,
          });
        }

        if (data?.is_admin === true && Platform.OS === 'web') {
          // แอดมิน (เว็บ) -> หน้าจัดการข้อมูล
          router.replace('/admin' as any);
        } else if (Platform.OS === 'web') {
          /*
           * Alert.alert บน Web ไม่รองรับปุ่มกำหนดเอง
           * onPress ของปุ่มจะไม่ถูกเรียก จึงต้อง navigate ทันที
           */
          router.replace('/home');
        } else {
          Alert.alert(
            'เข้าสู่ระบบสำเร็จ',
            `ยินดีต้อนรับ ${data?.name || ''}`,
            [
              {
                text: 'ตกลง',
                onPress: () => {
                  router.replace('/home');
                },
              },
            ]
          );
        }

        return;
      }

      /* =================================================
         LOGIN ERROR
         ================================================= */

      if (
        data?.detail ===
        'ไม่พบอีเมลนี้ในระบบ'
      ) {
        setEmailError(
          'อีเมลนี้ยังไม่เคยสมัครสมาชิก'
        );
      } else if (
        data?.detail ===
        'รหัสผ่านไม่ถูกต้อง'
      ) {
        setPasswordError(
          'รหัสผ่านไม่ถูกต้อง'
        );
      } else {
        Alert.alert(
          'เข้าสู่ระบบไม่สำเร็จ',
          data?.detail ||
            'กรุณาลองใหม่อีกครั้ง'
        );
      }
    } catch (error: any) {
      console.error(
        'LOGIN ERROR:',
        error
      );

      Alert.alert(
        'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
        `ไม่สามารถเชื่อมต่อ SafeRoute API ได้\n\nAPI: ${API_URL}\n\nกรุณาตรวจสอบว่า Backend กำลังทำงานอยู่ และมือถือกับคอมอยู่ Wi-Fi เดียวกัน`
      );
    } finally {
      setIsLoading(false);
    }
  };

  /* =====================================================
     UI
     ===================================================== */

  const formBody = (
    <>
            {/* =================================================
                EMAIL
                ================================================= */}

            <View
              style={styles.inputContainer}
            >
              <View
                style={
                  [styles.floatingLabelBox, isWide && styles.wideLabelBox]
                }
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
                  isWide && styles.wideInputPad,
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
                editable={!isLoading}
              />

              {isWide && (
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#8A94A0"
                  style={styles.wideIconLeft}
                />
              )}

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

            {/* =================================================
                PASSWORD
                ================================================= */}

            <View
              style={styles.inputContainer}
            >
              <View
                style={
                  [styles.floatingLabelBox, isWide && styles.wideLabelBox]
                }
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
                  isWide && styles.wideInputPad,
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
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />

              {isWide && (
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#8A94A0"
                  style={styles.wideIconLeft}
                />
              )}

              {isWide && (
                <TouchableOpacity
                  style={styles.wideIconRight}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color="#8A94A0"
                  />
                </TouchableOpacity>
              )}

              {passwordError !== '' && (
                <Text
                  style={styles.errorText}
                >
                  {passwordError}
                </Text>
              )}
            </View>

            {/* =================================================
                FORGOT PASSWORD
                ================================================= */}

            <TouchableOpacity
              onPress={() =>
                router.push(
                  '/forgot-password'
                )
              }
              style={
                styles.forgotPasswordLink
              }
              disabled={isLoading}
            >
              <Text
                style={
                  styles.forgotPasswordText
                }
              >
                ลืมรหัสผ่าน?
              </Text>
            </TouchableOpacity>

            {/* =================================================
                LOGIN BUTTON
                ================================================= */}

            <TouchableOpacity
              style={[
                styles.mainButton,
                isWide && styles.wideButton,
                isLoading &&
                  styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              <Text
                style={
                  styles.mainButtonText
                }
              >
                {isLoading
                  ? 'กำลังเข้าสู่ระบบ...'
                  : 'เข้าสู่ระบบ'}
              </Text>
            </TouchableOpacity>

            {/* =================================================
                REGISTER
                ================================================= */}

            <View
              style={styles.footerRow}
            >
              <Text
                style={styles.footerText}
              >
                ยังไม่มีบัญชีผู้ใช้?{' '}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  router.push('/register')
                }
                disabled={isLoading}
              >
                <Text
                  style={styles.footerLink}
                >
                  สมัครสมาชิก
                </Text>
              </TouchableOpacity>
            </View>

            {/* =================================================
                GUEST (ผู้เยี่ยมชม: ดูข้อมูลได้อย่างเดียว ไม่บันทึกแผนที่)
                ================================================= */}

            <TouchableOpacity
              style={styles.guestButton}
              activeOpacity={0.8}
              disabled={isLoading}
              onPress={async () => {
                await clearSession();
                router.replace('/home');
              }}
            >
              <Text style={styles.guestButtonText}>
                เข้าชมแบบผู้เยี่ยมชม
              </Text>
            </TouchableOpacity>
    </>
  );

  // เข้าแอปครั้งแรก (โหลดหน้าใหม่) -> ไปหน้าต้อนรับก่อน แล้วค่อยกลับมาที่หน้าเข้าสู่ระบบนี้
  if (!(globalThis as any).__srWelcomeShown) {
    return <Redirect href={'/welcome' as any} />;
  }

  /* ---------- จอกว้าง (เว็บบนคอม): แบ่งสองฝั่ง ---------- */
  if (isWide) {
    return (
      <View style={styles.wideRoot}>
        <HeroMap />

        <View style={styles.wideHero}>
          <View style={styles.heroContent}>
            <View style={[styles.heroBadgeInner, { backdropFilter: 'blur(14px)' } as any]}>
              <Ionicons name="shield-checkmark" size={94} color="#1B8F7C" />
            </View>
            <Text style={styles.heroBrand}>SAFEROUTE</Text>
          </View>
        </View>

        <View style={styles.widePanel}>
          <ScrollView
            contentContainerStyle={styles.widePanelScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.wideCard, { backdropFilter: 'blur(22px) saturate(1.5)', WebkitBackdropFilter: 'blur(22px) saturate(1.5)' } as any]}>
              {formBody}
            </View>
          </ScrollView>
        </View>
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
          keyboardShouldPersistTaps="handled"
        >
          {/* =================================================
              HEADER
              ================================================= */}

          <View style={styles.headerWrapper}>
            <ScreenHeader height={300}>
              <View
                style={styles.headerTextOverlay}
              >
                <Text
                  style={styles.brandLabel}
                >
                  SAFEROUTE
                </Text>

                <Text
                  style={styles.welcomeTitle}
                >
                  ยินดีต้อนรับกลับ
                </Text>

                <Text
                  style={styles.welcomeSubtitle}
                >
                  เข้าสู่ระบบเพื่อดูจุดเสี่ยงบนเส้นทางของคุณ
                </Text>
              </View>
            </ScreenHeader>
          </View>

          {/* =================================================
              FORM CARD
              ================================================= */}

          <View style={styles.bottomCard}>
            {formBody}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES
   ===================================================== */

const styles = StyleSheet.create({
  /* ===== จอกว้าง ===== */
  wideRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#C8F0E0',
  },
  wideHero: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '2%' as any,
    paddingHorizontal: 48,
  },
  heroCircleBig: {
    position: 'absolute',
    right: -160,
    top: -140,
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: '#5E7B63',
    opacity: 0.55,
  },
  heroCircleSmall: {
    position: 'absolute',
    left: -90,
    bottom: -110,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#8FA68A',
    opacity: 0.35,
  },
  heroContent: { alignItems: 'center' },
  heroBadgeWrap: {
    width: 380,
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingOuter: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    borderWidth: 1,
    borderColor: 'rgba(240,217,168,0.14)',
  },
  heroRingMid: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1,
    borderColor: 'rgba(240,217,168,0.24)',
  },
  heroDivider: {
    marginTop: 18,
    width: 64,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C18A26',
  },
  routeDot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    opacity: 0.9,
  },
  heroPin: { position: 'absolute' },
  panelCircleA: {
    position: 'absolute',
    right: -120,
    top: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(240,217,168,0.06)',
  },
  panelCircleB: {
    position: 'absolute',
    left: -80,
    bottom: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(240,217,168,0.05)',
  },
  wideCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: '#C18A26',
  },
  heroBadgeOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(240,217,168,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeInner: {
    width: 170,
    height: 170,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A3F4E',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.32,
    shadowRadius: 40,
  },
  heroBrand: {
    marginTop: 30,
    fontSize: 34,
    fontWeight: '800',
    color: '#0F5A62',
    letterSpacing: 12,
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },

  widePanel: {
    flex: 0.9,
    backgroundColor: 'transparent',
  },
  widePanelScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  wideCard: {
    width: '100%',
    maxWidth: 460,
    paddingTop: 44,
    paddingBottom: 40,
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
  wideLabelBox: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingVertical: 1 },
  wideInputPad: { paddingLeft: 46, paddingRight: 46 },
  wideIconLeft: { position: 'absolute', left: 16, top: 17 },
  wideIconRight: { position: 'absolute', right: 14, top: 15 },
  wideInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D5DAE0',
    borderRadius: 14,
    height: 54,
    color: '#1F2933',
  },
  wideButton: {
    backgroundColor: '#1F8F7C',
    borderRadius: 14,
    height: 54,
    shadowColor: '#1F8F7C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  widePanelFooter: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    color: '#9AA5B1',
    letterSpacing: 1,
  },
  wideCardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4A3B26',
  },
  wideCardSub: {
    fontSize: 14,
    color: '#7A6A52',
    marginTop: 6,
    marginBottom: 26,
  },
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

  headerTextOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 28,
    right: 28,
  },

  brandLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F0D9A8',
    letterSpacing: 2,
    marginBottom: 12,
  },

  welcomeTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },

  welcomeSubtitle: {
    fontSize: 13,
    color: '#E5D8C0',
    lineHeight: 19,
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
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },

  forgotPasswordText: {
    color: '#1B7F79',
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 24,
  },

  footerText: {
    color: '#6B5638',
    fontSize: 13,
  },

  footerLink: {
    color: '#1B7F79',
    fontSize: 13,
    fontWeight: '700',
  },

  guestButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1B7F79',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  guestButtonText: {
    color: '#1B7F79',
    fontSize: 14,
    fontWeight: '700',
  },
});