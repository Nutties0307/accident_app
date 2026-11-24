import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'saferoute_session';

export type Session = {
  userId: number;
  name?: string;
  email?: string;
  // ใหม่: ใช้เรียกหน้าแอดมิน (ผู้ใช้ทั่วไปไม่ต้องใช้)
  token?: string;
  isAdmin?: boolean;
};

// เรียกตอนล็อกอินสำเร็จ
export async function saveSession(session: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  } catch (error) {
    console.error('บันทึก session ไม่สำเร็จ:', error);
  }
}

// ถ้ายังไม่ล็อกอิน (หรืออ่านไม่ได้) จะได้ null
export async function getSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (typeof parsed?.userId !== 'number') return null;

    return parsed as Session;
  } catch {
    return null;
  }
}

// เรียกตอนกดออกจากระบบ (หน้า account)
export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (error) {
    console.error('ล้าง session ไม่สำเร็จ:', error);
  }
}