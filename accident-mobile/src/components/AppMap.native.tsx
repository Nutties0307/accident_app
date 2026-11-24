import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  MAP_CAPTURE_SOURCE,
  type AppMapHandle,
  type HighRiskMarker,
  type SnapshotInfo,
} from '../utils/mapSnapshot';

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
type LocationPoint = {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
};

function toLatLng(p: LocationPoint | null | undefined) {
  if (!p) return null;
  const lat = typeof p.latitude === 'number' ? p.latitude : p.lat;
  const lng = typeof p.longitude === 'number' ? p.longitude : p.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { latitude: lat, longitude: lng };
}

type Pending = {
  resolve: (url: string) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Props = {
  routeCoordinates?: RouteCoordinate[];
  routeRiskPoints?: RouteRiskPoint[];
  originLocation?: LocationPoint | null;
  destinationLocation?: LocationPoint | null;
  highRiskMarkers?: HighRiskMarker[];
};


const NO_MARKERS: HighRiskMarker[] = [];

const AppMapNative = forwardRef<AppMapHandle, Props>(function AppMapNative(
  {
    routeCoordinates = [],
    routeRiskPoints = [],
    originLocation = null,
    destinationLocation = null,
    highRiskMarkers = NO_MARKERS,
  },
  ref
) {
  const webViewRef = useRef<any>(null);
  const pendingRef = useRef<Record<string, Pending>>({});
  const counterRef = useRef(0);

  const html = useMemo(() => {
    const route = JSON.stringify(routeCoordinates);
    const riskPoints = JSON.stringify(routeRiskPoints);
    const origin = JSON.stringify(toLatLng(originLocation));
    const destination = JSON.stringify(toLatLng(destinationLocation));
    const marks = JSON.stringify(highRiskMarkers);

    return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
  />

  <title>SafeRoute Map</title>

  <style>
    html,
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #e5e7eb;
    }

    #map {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      background: #e5e7eb;
    }

    .loading {
      position: absolute;
      z-index: 9999;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 12px 18px;
      background: white;
      border-radius: 12px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #374151;
      box-shadow: 0 3px 15px rgba(0,0,0,0.15);
    }
  </style>

  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />
</head>

<body>

  <div id="map"></div>

  <div id="loading" class="loading">
    กำลังโหลดแผนที่...
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

  <script>
    const routeCoordinates = ${route};
    const routeRiskPoints = ${riskPoints};
    const originLocation = ${origin};
    const destinationLocation = ${destination};
    const highRiskMarkers = ${marks};

    const DEFAULT_ROUTE_COLOR = '#1976D2';

    function startMap() {

      const loading = document.getElementById('loading');

      if (!window.L) {
        loading.innerText = 'โหลดแผนที่ไม่สำเร็จ';
        return;
      }

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: true,
        tap: true,
      });

      L.control.zoom({
        position: 'bottomright'
      }).addTo(map);

      // crossOrigin: true จำเป็นเพื่อให้แคปแผนที่เป็นรูปได้
      const tileLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          crossOrigin: true,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);

      window.__map = map;
      window.__tileLayer = tileLayer;

      const allPoints = [];

      /*
       * จุดเริ่มต้น
       */
      if (
        originLocation &&
        typeof originLocation.latitude === 'number' &&
        typeof originLocation.longitude === 'number'
      ) {

        const origin = [
          originLocation.latitude,
          originLocation.longitude
        ];

        allPoints.push(origin);

        L.marker(origin)
          .addTo(map)
          .bindPopup('จุดเริ่มต้น');
      }

      
      if (
        destinationLocation &&
        typeof destinationLocation.latitude === 'number' &&
        typeof destinationLocation.longitude === 'number'
      ) {

        const destination = [
          destinationLocation.latitude,
          destinationLocation.longitude
        ];

        allPoints.push(destination);

        L.marker(destination)
          .addTo(map)
          .bindPopup('ปลายทาง');
      }

      
      if (
        Array.isArray(routeCoordinates) &&
        routeCoordinates.length > 0
      ) {

        const points = routeCoordinates
          .filter(
            p =>
              p &&
              typeof p.latitude === 'number' &&
              typeof p.longitude === 'number'
          )
          .map(p => [
            p.latitude,
            p.longitude
          ]);

        if (points.length > 0) {

          points.forEach(p => {
            allPoints.push(p);
          });

          const hasRiskData =
            Array.isArray(routeRiskPoints) &&
            routeRiskPoints.length === routeCoordinates.length;

          if (hasRiskData) {
            for (let i = 0; i < points.length - 1; i++) {
              const color =
                (routeRiskPoints[i] && routeRiskPoints[i].color) ||
                DEFAULT_ROUTE_COLOR;

              L.polyline([points[i], points[i + 1]], {
                color: color,
                weight: 6,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
            }
          } else {
            L.polyline(points, {
              color: DEFAULT_ROUTE_COLOR,
              weight: 6,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(map);
          }
        }
      }

      if (Array.isArray(highRiskMarkers)) {
        highRiskMarkers.forEach(m => {
          const icon = L.divIcon({
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            html:
              '<div style="width:40px;height:40px;border-radius:50%;' +
              'background:' + m.color + '4D;display:flex;' +
              'align-items:center;justify-content:center;">' +
              '<div style="width:26px;height:26px;border-radius:50%;' +
              'background:' + m.color + ';border:3px solid #fff;' +
              'box-sizing:content-box;color:#fff;font:700 13px sans-serif;' +
              'display:flex;align-items:center;justify-content:center;' +
              'box-shadow:0 1px 4px rgba(0,0,0,0.4);">' +
              String(m.no) +
              '</div></div>'
          });

          L.marker([m.latitude, m.longitude], {
            icon: icon,
            zIndexOffset: 1000,
            keyboard: false
          }).addTo(map);
        });
      }

      if (allPoints.length > 0) {

        const bounds = L.latLngBounds(allPoints);

        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16
        });

      } else {

        map.setView(
          [13.8199, 100.0622],
          13
        );
      }

      setTimeout(() => {

        map.invalidateSize();

        loading.style.display = 'none';

      }, 500);

      /*
       * กันกรณี WebView resize
       */
      setTimeout(() => {
        map.invalidateSize();
      }, 1000);

      setTimeout(() => {
        map.invalidateSize();
      }, 2000);
    }

    
    if (document.readyState === 'loading') {

      document.addEventListener(
        'DOMContentLoaded',
        startMap
      );

    } else {

      startMap();

    }
  </script>

</body>
</html>
`;
  }, [
    routeCoordinates,
    routeRiskPoints,
    originLocation,
    destinationLocation,
    highRiskMarkers,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      captureImage: (info: SnapshotInfo) =>
        new Promise<string>((resolve, reject) => {
          if (!webViewRef.current || routeCoordinates.length === 0) {
            reject(new Error('ยังไม่มีเส้นทางให้บันทึก'));
            return;
          }

          counterRef.current += 1;
          const id = String(counterRef.current);

          const timer = setTimeout(() => {
            delete pendingRef.current[id];
            reject(new Error('แคปแผนที่หมดเวลา'));
          }, 20000);

          pendingRef.current[id] = { resolve, reject, timer };

          const hasRiskData =
            routeRiskPoints.length === routeCoordinates.length;

          const o = toLatLng(originLocation);
          const d = toLatLng(destinationLocation);

          const data = {
            route: routeCoordinates.map((p) => [p.latitude, p.longitude]),
            colors: hasRiskData ? routeRiskPoints.map((p) => p.color) : [],
            origin: o ? [o.latitude, o.longitude] : null,
            dest: d ? [d.latitude, d.longitude] : null,
            marks: highRiskMarkers.map((m) => [
              m.latitude,
              m.longitude,
              m.no,
              m.color,
            ]),
            info,
          };

          const script =
            '(function(){' +
            'var post=function(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));};' +
            'try{' +
            'if(!window.__map||!window.__tileLayer){post({type:"capture",id:' +
            JSON.stringify(id) +
            ',err:"แผนที่ยังไม่พร้อม",url:null});return;}' +
            'var cap=(' +
            MAP_CAPTURE_SOURCE +
            ');' +
            'cap(window.__map,window.__tileLayer,' +
            JSON.stringify(data) +
            ',function(err,url){post({type:"capture",id:' +
            JSON.stringify(id) +
            ',err:err,url:url});});' +
            '}catch(e){post({type:"capture",id:' +
            JSON.stringify(id) +
            ',err:String(e&&e.message?e.message:e),url:null});}' +
            '})();true;';

          webViewRef.current.injectJavaScript(script);
        }),
    }),
    [
      routeCoordinates,
      routeRiskPoints,
      originLocation,
      destinationLocation,
      highRiskMarkers,
    ]
  );

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg && msg.type === 'capture') {
        const pending = pendingRef.current[msg.id];
        if (!pending) return;
        clearTimeout(pending.timer);
        delete pendingRef.current[msg.id];
        if (msg.err || !msg.url) {
          pending.reject(new Error(msg.err || 'แคปแผนที่ไม่สำเร็จ'));
        } else {
          pending.resolve(msg.url);
        }
      }
    } catch {
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        onMessage={handleMessage}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        cacheEnabled={true}
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onError={(event) => {
          console.log(
            'SafeRoute WebView ERROR:',
            event.nativeEvent
          );
        }}
        onHttpError={(event) => {
          console.log(
            'SafeRoute WebView HTTP ERROR:',
            event.nativeEvent
          );
        }}
      />
    </View>
  );
});

export default AppMapNative;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },

  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
});