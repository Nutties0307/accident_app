import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import AppMapWeb from '../components/AppMap.web';
import AppMapNative from '../components/AppMap.native';
import type {
  AppMapHandle,
  HighRiskMarker,
  SnapshotInfo,
} from '../utils/mapSnapshot';
import { getSession } from '../utils/session';
import type { SpeedCameraMarker } from '../components/AppMap.web';
import { TimeWeatherBrief, useCurrentWeather, type TimeWeather } from '../components/TimeWeatherInfo';
function cameraKind(name: string | null | undefined) {
  if (/red\s*light/i.test(name || '')) return 'กล้องจับฝ่าไฟแดง';
  if (/traffic\s*camera/i.test(name || '')) return 'กล้องจราจร';
  return 'กล้องตรวจจับความเร็ว';
}

function cameraLimitText(c: SpeedCameraMarker) {
  if (/red\s*light/i.test(c.name || '')) return 'ต้องหยุดเมื่อไฟแดง';
  if (c.speed_limit) return `ต้องขับไม่เกิน ${c.speed_limit} กม./ชม.`;
  return 'ไม่มีข้อมูลความเร็วจำกัด ดูป้ายริมทาง';
}

type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type RouteCoordinate = {
  latitude: number;
  longitude: number;
};
type RouteRiskPoint = {
  latitude: number;
  longitude: number;
  risk_level: string;
  color: string;
};
type RouteSummary = {
  total_km: number;
  levels: {
    level: string;
    color: string;
    km: number;
    percent: number;
  }[];
  high_risk_points: number;
  top_causes: { cause: string; count: number }[];
  time_weather?: TimeWeather | null;
  speed_cameras?: SpeedCameraMarker[];
  top_risk_points: {
    no: number;
    latitude: number;
    longitude: number;
    risk_level: string;
    color: string;
    province: string;
    top_cause: string;
    total_count: number;
    latest_year: number;
  }[];
};

type RouteInfo = {
  duration: string;
  distance: string;
};

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatThaiDateTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} ${hh}:${mm}`;
}

function buildSnapshotInfo(
  originName: string,
  destinationName: string,
  summary: RouteSummary,
  routeInfo: RouteInfo | null
): SnapshotInfo {
  const rows = summary.levels
    .filter((l) => l.km > 0)
    .map((l) => ({
      color: l.color,
      weight: l.km,
      text: `${l.level} ${l.percent < 1 ? '<1' : l.percent}%`,
    }));

  const topPoints = summary.top_risk_points ?? [];
  const points = topPoints.map((p) => ({
    no: p.no,
    color: p.color,
    text:
      `${p.risk_level} · ` +
      `จ.${(p.province || '').replace(/^จังหวัด/, '')} · ` +
      `${p.top_cause} · ${p.total_count} ครั้ง`,
  }));

  const pointsTitle =
    summary.high_risk_points > topPoints.length
      ? `จุดเสี่ยงสูง ${summary.high_risk_points} จุด (แสดง ${topPoints.length} จุดที่รุนแรงที่สุด)`
      : `จุดเสี่ยงสูง ${summary.high_risk_points} จุด`;

  const notes: string[] = [];

  if (summary.high_risk_points === 0) {
    notes.push('ไม่พบจุดเสี่ยงสูงบนเส้นทางนี้');
  }

  return {
    title: `${originName} → ${destinationName}`,
    subtitle:
      (routeInfo
        ? `${routeInfo.duration} · ${routeInfo.distance} · `
        : `${summary.total_km.toFixed(1)} กม. · `) +
      formatThaiDateTime(new Date()),
    rows,
    pointsTitle: points.length > 0 ? pointsTitle : undefined,
    points,
    notes,
  };
}

const API_URL = (() => {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:8000`;
  }

  return 'http://10.0.2.2:8000';
})();


function decodePolyline(encoded: string): RouteCoordinate[] {
  const coordinates: RouteCoordinate[] = [];

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat =
      result & 1 ? ~(result >> 1) : result >> 1;

    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng =
      result & 1 ? ~(result >> 1) : result >> 1;

    lng += deltaLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}
export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && screenWidth >= 900;

 

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [userPos, setUserPos] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let active = true;
    getSession().then((s) => {
      if (active) setIsGuest(!s);
    });
    return () => {
      active = false;
    };
  }, []);
  const [focusUserToken, setFocusUserToken] = useState(0);
  const [gpsMsg, setGpsMsg] = useState('');
  const gpsWatchRef = useRef<number | null>(null);
  const gpsFirstFixRef = useRef(false);
  const originLocationRef = useRef<Place | null>(null);

  const [originLocation, setOriginLocation] =
    useState<Place | null>(null);

  const [destinationLocation, setDestinationLocation] =
    useState<Place | null>(null);

  const [routeCoordinates, setRouteCoordinates] =
    useState<RouteCoordinate[]>([]);

  // ใหม่: สีความเสี่ยงของแต่ละจุดบนเส้นทาง
  const [routeRiskPoints, setRouteRiskPoints] =
    useState<RouteRiskPoint[]>([]);

  const [routeLoading, setRouteLoading] =
    useState(false);
  const [routeSummary, setRouteSummary] =
    useState<RouteSummary | null>(null);

  const [routeInfo, setRouteInfo] =
    useState<RouteInfo | null>(null);

  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  const mapRef = useRef<AppMapHandle>(null);
  const currentWeather = useCurrentWeather(
    API_URL,
    originLocation?.lat,
    originLocation?.lng
  );

  const highRiskMarkers = useMemo<HighRiskMarker[]>(
    () =>
      (routeSummary?.top_risk_points ?? []).map((p) => ({
        no: p.no,
        latitude: p.latitude,
        longitude: p.longitude,
        color: p.color,
        detail: {
          level: p.risk_level,
          province: p.province,
          cause: p.top_cause,
          count: p.total_count,
          year: p.latest_year,
        },
      })),
    [routeSummary]
  );

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [showRiskCard, setShowRiskCard] =
    useState(true);

  const [activeInput, setActiveInput] =
    useState<'origin' | 'destination' | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);


  const [originSuggestions, setOriginSuggestions] =
    useState<Place[]>([]);

  const [destinationSuggestions, setDestinationSuggestions] =
    useState<Place[]>([]);

  useEffect(() => {
    let cancelled = false;

    const searchPlaces = async (
      keyword: string,
      setter: React.Dispatch<React.SetStateAction<Place[]>>
    ) => {
      if (!keyword.trim()) {
        setter([]);
        return;
      }

      try {
        const url =
          `${API_URL}/api/places?query=` +
          encodeURIComponent(keyword.trim());

        console.log('PLACES SEARCH URL:', url);

        const response = await fetch(url);
        const data = await response.json();

        console.log(
          'PLACES RESPONSE:',
          JSON.stringify(data)
        );

        if (!response.ok) {
          throw new Error(
            data?.detail || 'ค้นหาสถานที่ไม่สำเร็จ'
          );
        }

        if (!cancelled) {
          setter(
            Array.isArray(data?.places)
              ? data.places.slice(0, 6)
              : []
          );
        }
      } catch (error) {
        console.error(
          'ค้นหาสถานที่ไม่สำเร็จ:',
          error
        );

        if (!cancelled) {
          setter([]);
        }
      }
    };

    const timer = setTimeout(() => {
      if (activeInput === 'origin') {
        searchPlaces(origin, setOriginSuggestions);
      }

      if (activeInput === 'destination') {
        searchPlaces(
          destination,
          setDestinationSuggestions
        );
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [origin, destination, activeInput]);


  const selectOrigin = (place: Place) => {
    setOrigin(place.name);
    setOriginLocation(place);
    setActiveInput(null);

    Keyboard.dismiss();
  };

  const selectDestination = (place: Place) => {
    setDestination(place.name);
    setDestinationLocation(place);
    setActiveInput(null);

    Keyboard.dismiss();
  };

  const swapLocations = () => {
    const oldOrigin = origin;
    const oldDestination = destination;

    const oldOriginLocation = originLocation;
    const oldDestinationLocation =
      destinationLocation;

    setOrigin(oldDestination);
    setDestination(oldOrigin);

    setOriginLocation(oldDestinationLocation);
    setDestinationLocation(oldOriginLocation);
  };


  const fetchRouteRisk = async (
    coordinates: RouteCoordinate[]
  ) => {
    if (!coordinates || coordinates.length === 0) {
      setRouteRiskPoints([]);
      setRouteSummary(null);
      return;
    }

    try {
      const url = `${API_URL}/api/route-risk`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          points: coordinates.map((c) => ({
            latitude: c.latitude,
            longitude: c.longitude,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'ไม่สามารถดึงข้อมูลความเสี่ยงของเส้นทางได้'
        );
      }

      setRouteRiskPoints(
        Array.isArray(data?.points) ? data.points : []
      );

      setRouteSummary(data?.summary ?? null);
    } catch (error) {
      console.error(
        'ดึงข้อมูลความเสี่ยงเส้นทางไม่สำเร็จ:',
        error
      );
      setRouteRiskPoints([]);
      setRouteSummary(null);
    }
  };

  const handleSearchRoute = async () => {
    if (!originLocation) {
      Alert.alert(
        'ยังไม่ได้เลือกต้นทาง',
        'กรุณาเลือกต้นทางจากรายการสถานที่'
      );
      return;
    }

    if (!destinationLocation) {
      Alert.alert(
        'ยังไม่ได้เลือกปลายทาง',
        'กรุณาเลือกปลายทางจากรายการสถานที่'
      );
      return;
    }

    if (
      originLocation.id ===
      destinationLocation.id
    ) {
      Alert.alert(
        'สถานที่เดียวกัน',
        'กรุณาเลือกต้นทางและปลายทางให้แตกต่างกัน'
      );
      return;
    }
    const freshOrigin =
      originLocation.id === 'current-location' && userPos
        ? {
            ...originLocation,
            lat: userPos.lat,
            lng: userPos.lng,
            address: `${userPos.lat.toFixed(5)}, ${userPos.lng.toFixed(5)}`,
          }
        : originLocation;

    if (freshOrigin !== originLocation) {
      setOriginLocation(freshOrigin);
    }

    Keyboard.dismiss();
    setActiveInput(null);
    setRouteLoading(true);

    console.log('====================================');
    console.log('SAFE ROUTE - SEARCH ROUTE');
    console.log(
      'ORIGIN:',
      originLocation.lat,
      originLocation.lng
    );
    console.log(
      'DESTINATION:',
      destinationLocation.lat,
      destinationLocation.lng
    );
    console.log('====================================');

    try {
    

      const originParam =
        `${freshOrigin.lat},${freshOrigin.lng}`;

      const destinationParam =
        `${destinationLocation.lat},${destinationLocation.lng}`;

      const url =
        `${API_URL}/api/directions` +
        `?origin=${encodeURIComponent(
          originParam
        )}` +
        `&destination=${encodeURIComponent(
          destinationParam
        )}`;

      console.log('DIRECTIONS URL:', url);

      const response = await fetch(url);

      const data = await response.json();

      console.log(
        'DIRECTIONS RESPONSE:',
        JSON.stringify(data)
      );

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            'ไม่สามารถค้นหาเส้นทางได้'
        );
      }

      if (
        !data?.routes ||
        data.routes.length === 0
      ) {
        throw new Error(
          'ไม่พบเส้นทางระหว่างสถานที่ที่เลือก'
        );
      }

      const route = data.routes[0];

      const encodedPolyline =
        route?.overview_polyline?.points;

      if (!encodedPolyline) {
        throw new Error(
          'ไม่พบข้อมูลเส้นทางจาก Google Directions'
        );
      }

      const coordinates =
        decodePolyline(encodedPolyline);

      console.log(
        'ROUTE COORDINATES:',
        coordinates.length
      );

      if (coordinates.length === 0) {
        throw new Error(
          'ไม่สามารถแปลงข้อมูลเส้นทางได้'
        );
      }

      setRouteCoordinates(coordinates);
      const leg = route?.legs?.[0];

      setRouteInfo(
        leg?.duration?.text && leg?.distance?.text
          ? {
              duration: leg.duration.text,
              distance: leg.distance.text,
            }
          : null
      );

      setShowRiskCard(true);
      setRouteRiskPoints([]);
      setRouteSummary(null);
      fetchRouteRisk(coordinates);

      setSearchOpen(false);

      Alert.alert(
        'ค้นหาเส้นทางสำเร็จ',
        `จาก ${originLocation.name}\nไป ${destinationLocation.name}`
      );
    } catch (error: any) {
      console.error(
        'ค้นหาเส้นทางไม่สำเร็จ:',
        error
      );

      Alert.alert(
        'ค้นหาเส้นทางไม่สำเร็จ',
        error?.message ||
          'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
      );
    } finally {
      setRouteLoading(false);
    }
  };


  const canSaveMap =
    routeCoordinates.length > 0 &&
    routeRiskPoints.length === routeCoordinates.length &&
    routeSummary !== null &&
    originLocation !== null &&
    destinationLocation !== null;

  const handleSaveMap = async () => {
    if (
      saving ||
      !canSaveMap ||
      !routeSummary ||
      !originLocation ||
      !destinationLocation
    ) {
      return;
    }

    const session = await getSession();

    if (!session) {
      setToast({
        text: 'กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อบันทึกแผนที่',
        ok: false,
      });
      router.push('/');
      return;
    }

    if (!mapRef.current) {
      setToast({ text: 'แผนที่ยังไม่พร้อม', ok: false });
      return;
    }

    setSaving(true);

    try {
      const info = buildSnapshotInfo(
        originLocation.name,
        destinationLocation.name,
        routeSummary,
        routeInfo
      );

      const imageDataUrl =
        await mapRef.current.captureImage(info);

      const response = await fetch(`${API_URL}/api/saved-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.userId,
          title: info.title,
          start_name: originLocation.name,
          start_lat: originLocation.lat,
          start_lon: originLocation.lng,
          end_name: destinationLocation.name,
          end_lat: destinationLocation.lat,
          end_lon: destinationLocation.lng,
          image_base64: imageDataUrl,
          summary: routeSummary,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : 'บันทึกแผนที่ไม่สำเร็จ'
        );
      }

      setToast({
        text: 'บันทึกแผนที่แล้ว ดูได้ที่แท็บ "ที่บันทึกไว้"',
        ok: true,
      });
    } catch (error: any) {
      console.error('บันทึกแผนที่ไม่สำเร็จ:', error);

      setToast({
        text: error?.message || 'บันทึกแผนที่ไม่สำเร็จ',
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  };


  useEffect(() => {
    originLocationRef.current = originLocation;
  }, [originLocation]);

  const startTracking = (userPressed: boolean) => {
    const geo: any = (globalThis as any).navigator?.geolocation;
    if (!geo) {
      setGpsMsg('อุปกรณ์นี้ไม่รองรับ GPS');
      return;
    }
    if (gpsWatchRef.current !== null) {
      if (userPressed) setFocusUserToken((t) => t + 1);
      return;
    }

    setGpsMsg('กำลังค้นหาตำแหน่ง...');
    gpsWatchRef.current = geo.watchPosition(
      (pos: any) => {
        const here = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserPos(here);
        setGpsMsg('');

        if (!gpsFirstFixRef.current) {
          gpsFirstFixRef.current = true;
          setFocusUserToken((t) => t + 1);
          if (!originLocationRef.current) {
            const place: Place = {
              id: 'current-location',
              name: 'ตำแหน่งปัจจุบัน',
              address: `${here.lat.toFixed(5)}, ${here.lng.toFixed(5)}`,
              lat: here.lat,
              lng: here.lng,
            };
            setOrigin(place.name);
            setOriginLocation(place);
          }
        }
      },
      (err: any) => {
        setGpsMsg(
          err && err.code === 1
            ? 'ไม่ได้รับอนุญาตใช้ตำแหน่ง (กดไอคอนกุญแจข้าง URL แล้วอนุญาต)'
            : 'หาตำแหน่งไม่ได้ ลองใหม่อีกครั้ง'
        );
        if (gpsWatchRef.current !== null) {
          geo.clearWatch(gpsWatchRef.current);
          gpsWatchRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  };

  const handleCurrentLocation = () => {
    startTracking(true);
    if (userPos && !originLocation) {
      const place: Place = {
        id: 'current-location',
        name: 'ตำแหน่งปัจจุบัน',
        address: `${userPos.lat.toFixed(5)}, ${userPos.lng.toFixed(5)}`,
        lat: userPos.lat,
        lng: userPos.lng,
      };
      setOrigin(place.name);
      setOriginLocation(place);
    }
  };

  useEffect(() => {
    startTracking(false);
    return () => {
      const geo: any = (globalThis as any).navigator?.geolocation;
      if (geo && gpsWatchRef.current !== null) {
        geo.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, []);


  const goToSearch = () => {
    router.push('/search');
  };

  const goToAccount = () => {
    router.push('/account');
  };


  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
      />


      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <AppMapWeb
            ref={mapRef}
            routeCoordinates={
              routeCoordinates
            }
            routeRiskPoints={
              routeRiskPoints
            }
            highRiskMarkers={
              highRiskMarkers
            }
            speedCameras={routeSummary?.speed_cameras}
            originLocation={
              originLocation
            }
            destinationLocation={
              destinationLocation
            }
            userLocation={userPos}
            focusUserToken={focusUserToken}
          />
        ) : (
          <AppMapNative
            ref={mapRef}
            routeCoordinates={
              routeCoordinates
            }
            routeRiskPoints={
              routeRiskPoints
            }
            highRiskMarkers={
              highRiskMarkers
            }
            originLocation={
              originLocation
            }
            destinationLocation={
              destinationLocation
            }
          />
        )}
      </View>


      {!searchOpen && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.searchBar, isWide && styles.wideSearchBar]}
          onPress={() => {
            setSearchOpen(true);
            setActiveInput('origin');
          }}
        >
          <View style={styles.searchIcon}>
            <Ionicons
              name="search"
              size={22}
              color="#555"
            />
          </View>

          <Text
            style={styles.searchPlaceholder}
          >
            จะไปที่ไหน?
          </Text>
        </TouchableOpacity>
      )}


      {searchOpen && (
        <View style={[styles.routePanel, isWide && styles.wideRoutePanel]}>
          {/* HEADER */}

          <View style={styles.routeHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setSearchOpen(false);
                setActiveInput(null);
                Keyboard.dismiss();
              }}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color="#222"
              />
            </TouchableOpacity>

            <Text
              style={styles.routeTitle}
            >
              ค้นหาเส้นทาง
            </Text>
          </View>

          {/* INPUT AREA */}

          <View
            style={styles.routeInputArea}
          >
            <View
              style={styles.verticalLine}
            />

            {/* ORIGIN */}

            <View
              style={styles.inputWrapper}
            >
              <View
                style={styles.startDot}
              />

              <TextInput
                style={styles.routeInput}
                placeholder="ตำแหน่งเริ่มต้น"
                placeholderTextColor="#999"
                value={origin}
                onChangeText={(text) => {
                  setOrigin(text);
                  setOriginLocation(null);
                  setActiveInput('origin');
                }}
                onFocus={() => {
                  setActiveInput('origin');
                }}
                autoCorrect={false}
              />

              {origin.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setOrigin('');
                    setOriginLocation(null);
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#aaa"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* SWAP */}

            <TouchableOpacity
              style={styles.swapButton}
              onPress={swapLocations}
            >
              <Ionicons
                name="swap-vertical"
                size={20}
                color="#1976D2"
              />
            </TouchableOpacity>

            {/* DESTINATION */}

            <View
              style={styles.inputWrapper}
            >
              <View
                style={styles.endDot}
              />

              <TextInput
                style={styles.routeInput}
                placeholder="ปลายทาง"
                placeholderTextColor="#999"
                value={destination}
                onChangeText={(text) => {
                  setDestination(text);
                  setDestinationLocation(null);
                  setActiveInput(
                    'destination'
                  );
                }}
                onFocus={() => {
                  setActiveInput(
                    'destination'
                  );
                }}
                autoCorrect={false}
              />

              {destination.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setDestination('');
                    setDestinationLocation(null);
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#aaa"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>


          {activeInput === 'origin' && (
            <View
              style={styles.suggestionsBox}
            >
              {originSuggestions.length > 0 ? (
                originSuggestions.map(
                  (place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={
                        styles.suggestionItem
                      }
                      activeOpacity={0.7}
                      onPress={() =>
                        selectOrigin(
                          place
                        )
                      }
                    >
                      <View
                        style={
                          styles.placeIcon
                        }
                      >
                        <Ionicons
                          name="location-outline"
                          size={21}
                          color="#555"
                        />
                      </View>

                      <View
                        style={
                          styles.placeTextContainer
                        }
                      >
                        <Text
                          style={
                            styles.placeName
                          }
                          numberOfLines={1}
                        >
                          {place.name}
                        </Text>

                        <Text
                          style={
                            styles.placeAddress
                          }
                          numberOfLines={1}
                        >
                          {place.address}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                )
              ) : (
                <View
                  style={styles.noResult}
                >
                  <Ionicons
                    name="search-outline"
                    size={22}
                    color="#999"
                  />

                  <Text
                    style={
                      styles.noResultText
                    }
                  >
                    ไม่พบสถานที่
                  </Text>
                </View>
              )}
            </View>
          )}


          {activeInput ===
            'destination' && (
            <View
              style={styles.suggestionsBox}
            >
              {destinationSuggestions.length >
              0 ? (
                destinationSuggestions.map(
                  (place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={
                        styles.suggestionItem
                      }
                      activeOpacity={0.7}
                      onPress={() =>
                        selectDestination(
                          place
                        )
                      }
                    >
                      <View
                        style={
                          styles.placeIcon
                        }
                      >
                        <Ionicons
                          name="location-outline"
                          size={21}
                          color="#555"
                        />
                      </View>

                      <View
                        style={
                          styles.placeTextContainer
                        }
                      >
                        <Text
                          style={
                            styles.placeName
                          }
                          numberOfLines={1}
                        >
                          {place.name}
                        </Text>

                        <Text
                          style={
                            styles.placeAddress
                          }
                          numberOfLines={1}
                        >
                          {place.address}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                )
              ) : (
                <View
                  style={styles.noResult}
                >
                  <Ionicons
                    name="search-outline"
                    size={22}
                    color="#999"
                  />

                  <Text
                    style={
                      styles.noResultText
                    }
                  >
                    ไม่พบสถานที่
                  </Text>
                </View>
              )}
            </View>
          )}


          <TouchableOpacity
            style={[
              styles.routeButton,
              routeLoading &&
                styles.routeButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={routeLoading}
            onPress={handleSearchRoute}
          >
            <Ionicons
              name={
                routeLoading
                  ? 'sync'
                  : 'navigate'
              }
              size={20}
              color="#fff"
            />

            <Text
              style={
                styles.routeButtonText
              }
            >
              {routeLoading
                ? 'กำลังค้นหาเส้นทาง...'
                : 'ค้นหาเส้นทาง'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {routeCoordinates.length > 0 && !searchOpen && (
        <TouchableOpacity
          style={[
            styles.saveButton,
            isWide && styles.wideSave,
            (!canSaveMap || saving) &&
              styles.saveButtonDisabled,
          ]}
          activeOpacity={0.85}
          disabled={!canSaveMap || saving}
          onPress={handleSaveMap}
        >
          <Ionicons
            name={saving ? 'sync' : 'bookmark'}
            size={18}
            color="#fff"
          />

          <Text style={styles.saveButtonText}>
            {saving
              ? 'กำลังบันทึก...'
              : canSaveMap
              ? isGuest
                ? 'เข้าสู่ระบบเพื่อบันทึกแผนที่'
                : 'บันทึกแผนที่'
              : 'กำลังประเมินความเสี่ยง...'}
          </Text>
        </TouchableOpacity>
      )}

      {toast && (
        <View
          style={[
            styles.toast,
            isWide && styles.wideToast,
            toast.ok
              ? styles.toastOk
              : styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>
            {toast.text}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.locationButton,
          searchOpen &&
            styles.locationButtonWhenSearch,
          isWide && styles.wideLocation,
        ]}
        activeOpacity={0.85}
        onPress={handleCurrentLocation}
      >
        <Ionicons
          name="locate"
          size={24}
          color="#333"
        />
      </TouchableOpacity>

      {gpsMsg !== '' && (
        <View style={{ position: 'absolute', right: 16, bottom: 150, maxWidth: 260, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontSize: 12 }}>{gpsMsg}</Text>
        </View>
      )}


      {showRiskCard &&
        !searchOpen &&
        routeCoordinates.length > 0 && (
          <View style={[styles.riskCard, isWide && styles.wideRisk]}>
            <View
              style={[
                styles.riskIconContainer,
                routeSummary &&
                  routeSummary.high_risk_points === 0 &&
                  styles.riskIconSafe,
              ]}
            >
              <Ionicons
                name={
                  routeSummary &&
                  routeSummary.high_risk_points === 0
                    ? 'checkmark'
                    : 'warning'
                }
                size={25}
                color="#fff"
              />
            </View>

            <View style={styles.riskContent}>
              {routeInfo && (
                <Text style={styles.riskTitle}>
                  {routeInfo.duration} · {routeInfo.distance}
                </Text>
              )}

              {!routeSummary ? (
                <Text style={styles.riskDescription}>
                  กำลังประเมินความเสี่ยงของเส้นทาง...
                </Text>
              ) : (
                <>
                  <View style={styles.chipRow}>
                    <View
                      style={[
                        styles.chip,
                        routeSummary.high_risk_points > 0
                          ? styles.chipWarn
                          : styles.chipOk,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color:
                              routeSummary.high_risk_points > 0
                                ? '#BF360C'
                                : '#1B5E20',
                          },
                        ]}
                      >
                        {routeSummary.high_risk_points > 0
                          ? `จุดเสี่ยงสูง ${routeSummary.high_risk_points} จุด`
                          : 'ไม่พบจุดเสี่ยงสูง'}
                      </Text>
                    </View>

                  </View>

                  {routeSummary.speed_cameras &&
                    routeSummary.speed_cameras.length > 0 && (
                      <View style={styles.camBox}>
                        <Ionicons
                          name="camera"
                          size={18}
                          color="#6A1B9A"
                          style={{ marginTop: 1 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.camTitle}>
                            มีกล้องบนเส้นทางนี้{' '}
                            {routeSummary.speed_cameras.length} จุด
                          </Text>
                          {routeSummary.speed_cameras.slice(0, 3).map((c) => (
                            <Text key={c.no} style={styles.camLine}>
                              • {cameraKind(c.name)} ห่างจากต้นทาง ~{c.km_from_start} กม.
                              {'\n   '}
                              {cameraLimitText(c)}
                            </Text>
                          ))}
                          {routeSummary.speed_cameras.length > 3 && (
                            <Text style={styles.camMore}>
                              และอีก {routeSummary.speed_cameras.length - 3} จุด (กดไอคอนสีม่วงบนแผนที่)
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                  {routeSummary.top_causes.length > 0 && (
                    <Text style={styles.causeLine}>
                      สาเหตุที่พบบ่อย:{' '}
                      {routeSummary.top_causes
                        .map((c) => c.cause)
                        .join(', ')}
                    </Text>
                  )}

                  <TimeWeatherBrief
                    tw={routeSummary.time_weather}
                    current={currentWeather}
                  />
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.riskClose}
              onPress={() => setShowRiskCard(false)}
            >
              <Ionicons
                name="close"
                size={20}
                color="#777"
              />
            </TouchableOpacity>
          </View>
        )}


      <View style={[styles.bottomNav, isWide && styles.wideNav]}>
        {/* MAP */}

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
        >
          <Ionicons
            name="map"
            size={25}
            color="#1976D2"
          />

          <Text
            style={[
              styles.navText,
              styles.navTextActive,
            ]}
          >
            แผนที่
          </Text>
        </TouchableOpacity>

        {/* SAVED MAPS */}

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={goToSearch}
        >
          <Ionicons
            name="bookmark-outline"
            size={25}
            color="#666"
          />

          <Text
            style={styles.navText}
          >
            ที่บันทึกไว้
          </Text>
        </TouchableOpacity>

        {/* ACCOUNT */}

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.7}
          onPress={goToAccount}
        >
          <Ionicons
            name="person-outline"
            size={25}
            color="#666"
          />

          <Text
            style={styles.navText}
          >
            บัญชี
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },


  mapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    elevation: 0,
    backgroundColor: '#e5e7eb',
  },

  searchBar: {
    position: 'absolute',
    top:
      Platform.OS === 'web'
        ? 20
        : 55,
    left: 16,
    right: 16,

    height: 58,

    backgroundColor: '#fff',

    borderRadius: 18,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 16,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.18,
    shadowRadius: 7,

    elevation: 6,

    zIndex: 20,
  },

  searchIcon: {
    width: 38,
    height: 38,

    borderRadius: 19,

    backgroundColor: '#f3f4f6',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 12,
  },

  searchPlaceholder: {
    fontSize: 16,
    color: '#777',
    fontWeight: '500',
  },


  routePanel: {
    position: 'absolute',

    top:
      Platform.OS === 'web'
        ? 15
        : 45,

    left: 12,
    right: 12,

    backgroundColor: '#fff',

    borderRadius: 20,

    paddingBottom: 14,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,

    elevation: 10,

    zIndex: 100,
  },

  routeHeader: {
    height: 58,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 8,

    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  backButton: {
    width: 45,
    height: 45,

    alignItems: 'center',
    justifyContent: 'center',
  },

  routeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',

    marginLeft: 4,
  },


  routeInputArea: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,

    position: 'relative',
  },

  verticalLine: {
    position: 'absolute',

    left: 28,
    top: 32,
    bottom: 32,

    width: 2,

    backgroundColor: '#ddd',
  },

  inputWrapper: {
    height: 52,

    flexDirection: 'row',
    alignItems: 'center',

    position: 'relative',

    zIndex: 5,
  },

  startDot: {
    width: 12,
    height: 12,

    borderRadius: 6,

    backgroundColor: '#1976D2',

    marginHorizontal: 10,

    zIndex: 10,
  },

  endDot: {
    width: 12,
    height: 12,

    borderRadius: 6,

    backgroundColor: '#E53935',

    marginHorizontal: 10,

    zIndex: 10,
  },

  routeInput: {
    flex: 1,

    height: 46,

    backgroundColor: '#f5f6f8',

    borderRadius: 12,

    paddingHorizontal: 14,

    fontSize: 15,
    color: '#222',

    paddingRight: 42,
  },

  clearButton: {
    position: 'absolute',

    right: 12,

    width: 32,
    height: 32,

    alignItems: 'center',
    justifyContent: 'center',
  },

  swapButton: {
    position: 'absolute',

    right: 25,
    top: 46,

    width: 34,
    height: 34,

    borderRadius: 17,

    backgroundColor: '#fff',

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
    borderColor: '#ddd',

    zIndex: 20,

    elevation: 3,
  },


  suggestionsBox: {
    marginHorizontal: 16,

    backgroundColor: '#fff',

    borderRadius: 14,

    borderWidth: 1,
    borderColor: '#eee',

    overflow: 'hidden',

    maxHeight: 310,

    zIndex: 200,

    elevation: 8,
  },

  suggestionItem: {
    minHeight: 58,

    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: 12,

    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  placeIcon: {
    width: 38,
    height: 38,

    borderRadius: 19,

    backgroundColor: '#f3f4f6',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 10,
  },

  placeTextContainer: {
    flex: 1,
  },

  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },

  placeAddress: {
    fontSize: 12,
    color: '#888',

    marginTop: 3,
  },

  noResult: {
    height: 70,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 8,
  },

  noResultText: {
    fontSize: 14,
    color: '#888',
  },


  routeButton: {
    height: 50,

    marginHorizontal: 16,
    marginTop: 14,

    borderRadius: 13,

    backgroundColor: '#1976D2',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 8,

    shadowColor: '#1976D2',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.25,
    shadowRadius: 5,

    elevation: 4,
  },

  routeButtonDisabled: {
    opacity: 0.7,
  },

  routeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },


  saveButton: {
    position: 'absolute',

    top: Platform.OS === 'web' ? 90 : 125,
    right: 16,

    height: 42,

    paddingHorizontal: 16,

    borderRadius: 21,

    backgroundColor: '#1976D2',

    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,

    elevation: 6,

    zIndex: 25,
  },

  saveButtonDisabled: {
    backgroundColor: '#90A4AE',
  },

  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  toast: {
    position: 'absolute',

    left: 16,
    right: 16,
    bottom: 100,

    paddingVertical: 12,
    paddingHorizontal: 16,

    borderRadius: 12,

    zIndex: 60,

    elevation: 12,
  },

  toastOk: {
    backgroundColor: '#2E7D32',
  },

  toastError: {
    backgroundColor: '#C62828',
  },

  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  locationButton: {
    position: 'absolute',

    right: 16,
    bottom: 95,

    width: 52,
    height: 52,

    borderRadius: 26,

    backgroundColor: '#fff',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,

    elevation: 6,

    zIndex: 15,
  },

  locationButtonWhenSearch: {
    bottom: 95,
  },

  riskCard: {
    position: 'absolute',

    left: 16,
    right: 16,

    bottom: 100,

    minHeight: 86,

    backgroundColor: '#fff',

    borderRadius: 16,

    flexDirection: 'row',
    alignItems: 'center',

    padding: 12,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 7,

    elevation: 6,

    zIndex: 10,
  },

  riskIconContainer: {
    width: 48,
    height: 48,

    borderRadius: 24,

    backgroundColor: '#F57C00',

    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',

    marginRight: 12,
  },

  riskIconSafe: {
    backgroundColor: '#2E7D32',
  },

  riskContent: {
    flex: 1,
    paddingRight: 52,
  },

  riskTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },

  riskDescription: {
    fontSize: 12,
    color: '#666',

    marginTop: 3,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  chipWarn: { backgroundColor: '#FFF3E0' },
  chipOk: { backgroundColor: '#E8F5E9' },
  chipCam: { backgroundColor: '#F3E5F5' },

  chipText: { fontSize: 13, fontWeight: '700' },

  camBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F3E5F5',
  },
  camTitle: { fontSize: 14, fontWeight: '700', color: '#4A148C' },
  camLine: { fontSize: 13, color: '#4A148C', marginTop: 4, lineHeight: 19 },
  camMore: { fontSize: 12, color: '#6A1B9A', marginTop: 4 },

  causeLine: {
    fontSize: 13,
    color: '#444',
    marginTop: 8,
    lineHeight: 19,
  },

  riskCause: {
    fontSize: 11,
    color: '#F57C00',

    marginTop: 3,
  },

  riskClose: {
    width: 32,
    height: 32,

    alignItems: 'center',
    justifyContent: 'center',
  },

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

    paddingBottom:
      Platform.OS === 'ios'
        ? 12
        : 4,

    zIndex: 30,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 5,

    elevation: 10,
  },

  navItem: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    height: 70,
  },

  navText: {
    fontSize: 12,

    color: '#666',

    marginTop: 4,

    fontWeight: '500',
  },

  navTextActive: {
    color: '#1976D2',
    fontWeight: '700',
  },

  wideSearchBar: {
    right: 'auto',
    left: 20,
    top: 20,
    width: 400,
    height: 52,
    borderRadius: 26,
  },

  wideRoutePanel: {
    right: 'auto',
    left: 20,
    top: 20,
    width: 400,
    maxHeight: '88%',
    borderRadius: 18,
  },

  wideSave: {
    top: 20,
    right: 20,
  },

  wideRisk: {
    right: 'auto',
    left: 20,
    top: 84,
    bottom: 'auto',
    width: 400,
  },

  wideNav: {
    right: 'auto',
    left: '50%',
    marginLeft: -190,
    width: 380,
    bottom: 20,
    height: 66,
    borderRadius: 33,
    borderTopWidth: 0,
    paddingBottom: 0,
    overflow: 'hidden',
  },

  wideLocation: {
    right: 20,
    bottom: 24,
  },

  wideToast: {
    right: 'auto',
    left: '50%',
    marginLeft: -210,
    width: 420,
    bottom: 100,
  },
});