import React, {
  useEffect,
  useRef,
} from 'react';

import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';

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

type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type AppMapProps = {
  routeCoordinates?: RouteCoordinate[];

  // ใหม่: สีความเสี่ยงของแต่ละจุดบนเส้นทาง (index ต้องตรงกับ routeCoordinates)
  routeRiskPoints?: RouteRiskPoint[];

  originLocation?: Place | null;

  destinationLocation?: Place | null;
};

const DEFAULT_ROUTE_COLOR = '#1976D2';

export default function AppMap({
  routeCoordinates = [],
  routeRiskPoints = [],
  originLocation = null,
  destinationLocation = null,
}: AppMapProps) {
  const mapRef =
    useRef<any>(null);

  const leafletRef =
    useRef<any>(null);

  const routeLayerRef =
    useRef<any>(null);

  const originMarkerRef =
    useRef<any>(null);

  const destinationMarkerRef =
    useRef<any>(null);

  // =====================================================
  // LOAD LEAFLET
  // =====================================================

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    let cancelled = false;

    const loadMap = async () => {
      try {
        // -----------------------------------------------
        // CSS
        // -----------------------------------------------

        if (
          !document.getElementById(
            'leaflet-css'
          )
        ) {
          const link =
            document.createElement(
              'link'
            );

          link.id = 'leaflet-css';

          link.rel = 'stylesheet';

          link.href =
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

          document.head.appendChild(link);
        }

        // -----------------------------------------------
        // JS
        // -----------------------------------------------

        if (!(window as any).L) {
          await new Promise<void>(
            (resolve, reject) => {
              const existing =
                document.getElementById(
                  'leaflet-js'
                );

              if (existing) {
                existing.addEventListener(
                  'load',
                  () => resolve()
                );

                existing.addEventListener(
                  'error',
                  () =>
                    reject(
                      new Error(
                        'โหลด Leaflet ไม่สำเร็จ'
                      )
                    )
                );

                return;
              }

              const script =
                document.createElement(
                  'script'
                );

              script.id =
                'leaflet-js';

              script.src =
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

              script.async = true;

              script.onload = () =>
                resolve();

              script.onerror = () =>
                reject(
                  new Error(
                    'โหลด Leaflet ไม่สำเร็จ'
                  )
                );

              document.body.appendChild(
                script
              );
            }
          );
        }

        if (cancelled) {
          return;
        }

        const L = (window as any).L;

        leafletRef.current = L;

        // -----------------------------------------------
        // CREATE MAP
        // -----------------------------------------------

        if (!mapRef.current) {
          const mapElement =
            document.getElementById(
              'safe-route-map'
            );

          if (!mapElement) {
            return;
          }

          const map =
            L.map(
              mapElement,
              {
                zoomControl: false,
                attributionControl: true,
              }
            );

          map.setView(
            [13.8199, 100.0622],
            11
          );

          // ---------------------------------------------
          // OPENSTREETMAP
          // ---------------------------------------------

          L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              maxZoom: 19,

              attribution:
                '&copy; OpenStreetMap contributors',
            }
          ).addTo(map);

          mapRef.current = map;

          // Fix map size after rendering
          setTimeout(() => {
            try {
              map.invalidateSize();
            } catch {}
          }, 300);
        }

      } catch (error) {
        console.error(
          'APP MAP ERROR:',
          error
        );
      }
    };

    loadMap();

    return () => {
      cancelled = true;
    };
  }, []);

  // =====================================================
  // UPDATE ROUTE
  // =====================================================

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    console.log(
      '========================================'
    );

    console.log(
      'APP MAP - ROUTE UPDATE'
    );

    console.log(
      'routeCoordinates:',
      routeCoordinates.length
    );

    console.log(
      'routeRiskPoints:',
      routeRiskPoints.length
    );

    console.log(
      '========================================'
    );

    const map =
      mapRef.current;

    const L =
      leafletRef.current;

    if (!map || !L) {
      console.log(
        'MAP / LEAFLET ยังไม่พร้อม'
      );

      return;
    }

    // ===================================================
    // REMOVE OLD ROUTE
    // ===================================================

    if (routeLayerRef.current) {
      map.removeLayer(
        routeLayerRef.current
      );

      routeLayerRef.current = null;
    }

    // ===================================================
    // REMOVE OLD MARKERS
    // ===================================================

    if (originMarkerRef.current) {
      map.removeLayer(
        originMarkerRef.current
      );

      originMarkerRef.current = null;
    }

    if (destinationMarkerRef.current) {
      map.removeLayer(
        destinationMarkerRef.current
      );

      destinationMarkerRef.current = null;
    }

    // ===================================================
    // NO ROUTE
    // ===================================================

    if (
      !routeCoordinates ||
      routeCoordinates.length === 0
    ) {
      return;
    }

    // ===================================================
    // CREATE ROUTE (เส้นสีตามความเสี่ยง)
    // ===================================================

    const latLngs =
      routeCoordinates.map(
        (point) => [
          point.latitude,
          point.longitude,
        ]
      );

    // ---------------------------------------------------
    // Shadow / outline (เส้นขาวรองพื้น ให้เห็นเส้นทางชัดขึ้น)
    // ---------------------------------------------------

    const routeOutline =
      L.polyline(
        latLngs,
        {
          color: '#ffffff',
          weight: 9,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }
      ).addTo(map);

    const routeLayers: any[] = [routeOutline];

    // ---------------------------------------------------
    // ถ้ามีข้อมูลความเสี่ยงครบตามจำนวนจุด -> วาดเป็นท่อนสี
    // ถ้าไม่มี (เช่น backend เรียกไม่สำเร็จ) -> ใช้เส้นน้ำเงินเดิมสำรอง
    // ---------------------------------------------------

    const hasRiskData =
      routeRiskPoints &&
      routeRiskPoints.length === routeCoordinates.length;

    if (hasRiskData) {
      for (let i = 0; i < latLngs.length - 1; i++) {
        const color =
          routeRiskPoints[i]?.color || DEFAULT_ROUTE_COLOR;

        const segment = L.polyline(
          [latLngs[i], latLngs[i + 1]],
          {
            color,
            weight: 6,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }
        ).addTo(map);

        routeLayers.push(segment);
      }
    } else {
      const routeLine = L.polyline(
        latLngs,
        {
          color: DEFAULT_ROUTE_COLOR,
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }
      ).addTo(map);

      routeLayers.push(routeLine);
    }

    // Group all layers
    routeLayerRef.current =
      L.layerGroup(routeLayers).addTo(map);

    // ===================================================
    // ORIGIN MARKER
    // ===================================================

    if (originLocation) {
      const originIcon =
        L.divIcon({
          className:
            'safe-route-origin-marker',

          html: `
            <div style="
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: #1976D2;
              border: 4px solid white;
              box-shadow: 0 2px 7px rgba(0,0,0,.35);
            "></div>
          `,

          iconSize: [
            22,
            22,
          ],

          iconAnchor: [
            11,
            11,
          ],
        });

      originMarkerRef.current =
        L.marker(
          [
            originLocation.lat,
            originLocation.lng,
          ],
          {
            icon: originIcon,
            zIndexOffset: 1000,
          }
        )
          .addTo(map)
          .bindPopup(
            `<b>ต้นทาง</b><br/>${originLocation.name}`
          );
    }

    // ===================================================
    // DESTINATION MARKER
    // ===================================================

    if (destinationLocation) {
      const destinationIcon =
        L.divIcon({
          className:
            'safe-route-destination-marker',

          html: `
            <div style="
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: #E53935;
              border: 4px solid white;
              box-shadow: 0 2px 7px rgba(0,0,0,.35);
            "></div>
          `,

          iconSize: [
            22,
            22,
          ],

          iconAnchor: [
            11,
            11,
          ],
        });

      destinationMarkerRef.current =
        L.marker(
          [
            destinationLocation.lat,
            destinationLocation.lng,
          ],
          {
            icon: destinationIcon,
            zIndexOffset: 1000,
          }
        )
          .addTo(map)
          .bindPopup(
            `<b>ปลายทาง</b><br/>${destinationLocation.name}`
          );
    }

    // ===================================================
    // FIT ROUTE
    // ===================================================

    try {
      const bounds =
        L.latLngBounds(
          latLngs
        );

      map.fitBounds(
        bounds,
        {
          paddingTopLeft: [
            30,
            130,
          ],

          paddingBottomRight: [
            30,
            190,
          ],

          maxZoom: 14,

          animate: true,
        }
      );
    } catch (error) {
      console.error(
        'FIT ROUTE ERROR:',
        error
      );
    }

    setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 300);

  }, [
    routeCoordinates,
    routeRiskPoints,
    originLocation,
    destinationLocation,
  ]);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <View
      style={styles.container}
    >
      <div
        id="safe-route-map"
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',

    left: 0,
    right: 0,
    top: 0,
    bottom: 0,

    overflow: 'hidden',
  },
});