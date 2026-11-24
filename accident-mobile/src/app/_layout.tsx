import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.log('ไม่สามารถซ่อน Splash Screen:', error);
      }
    };

    hideSplash();
  }, []);

  return (
    <ThemeProvider
      value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
       
        <Stack.Screen name="index" />

        <Stack.Screen name="home" />

        <Stack.Screen name="register" />

        <Stack.Screen name="forgot-password" />

        <Stack.Screen name="reset-password" />

        <Stack.Screen name="explore" />
      </Stack>
    </ThemeProvider>
  );
}