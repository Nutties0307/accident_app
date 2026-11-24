import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';

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

type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type SpeedCameraMarker = {
  no: number;
  latitude: number;
  longitude: number;
  name: string | null;
  speed_limit: number | null;
  km_from_start: number;
};

type AppMapProps = {
  routeCoordinates?: RouteCoordinate[];

  // ใหม่: สีความเสี่ยงของแต่ละจุดบนเส้นทาง (index ต้องตรงกับ routeCoordinates)
  routeRiskPoints?: RouteRiskPoint[];

  originLocation?: Place | null;

  destinationLocation?: Place | null;

  // ใหม่: หมุดเลขจุดเสี่ยงสูง (แสดงเด่นบนแผนที่ และใส่ในรูปที่บันทึก)
  highRiskMarkers?: HighRiskMarker[];

  // กล้องตรวจจับความเร็วบนเส้นทาง
  speedCameras?: SpeedCameraMarker[];

  // ตำแหน่ง GPS ปัจจุบันของผู้ใช้ (จุดฟ้า เลื่อนตามเมื่อเคลื่อนที่)
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;

  // เปลี่ยนค่าเมื่อไหร่ แผนที่จะเลื่อนไปที่ตำแหน่งผู้ใช้
  focusUserToken?: number;
};

const DEFAULT_ROUTE_COLOR = '#1976D2';

// ที่อยู่ backend สำหรับดึงภาพ Street View (ใช้ค่าเดียวกับหน้า home)
const SV_API = (process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/$/, '');

// ค่าเริ่มต้นต้องเป็นตัวเดิมทุกครั้ง ไม่งั้น effect/useMemo จะทำงานซ้ำทุกการเรนเดอร์
const NO_MARKERS: HighRiskMarker[] = [];
const NO_CAMERAS: SpeedCameraMarker[] = [];


const AppMap = forwardRef<AppMapHandle, AppMapProps>(function AppMap(
  {
    routeCoordinates = [],
    routeRiskPoints = [],
    originLocation = null,
    destinationLocation = null,
    highRiskMarkers = NO_MARKERS,
    speedCameras = NO_CAMERAS,
    userLocation = null,
    focusUserToken = 0,
  },
  ref
) {
  const mapRef =
    useRef<any>(null);

  // กล่องของแผนที่ตัวนี้เอง (ไม่ใช้ id เพราะหน้าเก่าที่ถูกซ่อนอาจยังมี id เดียวกันค้างอยู่)
  const containerRef =
    useRef<any>(null);

  const resizeObserverRef =
    useRef<any>(null);

  const tileLayerRef =
    useRef<any>(null);

  const leafletRef =
    useRef<any>(null);

  const routeLayerRef =
    useRef<any>(null);

  const originMarkerRef =
    useRef<any>(null);

  const userMarkerRef =
    useRef<any>(null);

  const userAccuracyRef =
    useRef<any>(null);

  const destinationMarkerRef =
    useRef<any>(null);

  // map สร้างเสร็จแล้วหรือยัง (ให้ effect วาดเส้นทางรู้ว่าต้องวาดใหม่หลังกลับมาหน้านี้)
  const [mapReady, setMapReady] =
    useState(false);

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
            containerRef.current;

          if (!mapElement) {
            return;
          }

          // กันเคส "Map container is already initialized"
          // (container เก่ายังมีร่องรอยของ map ตัวก่อนค้างอยู่)
          if ((mapElement as any)._leaflet_id) {
            delete (mapElement as any)._leaflet_id;
            mapElement.innerHTML = '';
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

          tileLayerRef.current = L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
              maxZoom: 19,

              // ต้องเปิด CORS ไม่งั้นแคปแผนที่เป็นรูปไม่ได้ (canvas โดนบล็อก)
              crossOrigin: true,

              attribution:
                '&copy; OpenStreetMap contributors',
            }
          ).addTo(map);

          mapRef.current = map;

          // กล่องเปลี่ยนขนาด/กลับมาแสดงอีกครั้ง -> ให้ Leaflet คำนวณขนาดใหม่
          if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver(() => {
              try {
                map.invalidateSize();
              } catch {}
            });

            ro.observe(mapElement);
            resizeObserverRef.current = ro;
          }

          setMapReady(true);

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

      // ออกจากหน้านี้ -> ทำลาย map ให้เกลี้ยง กลับมาจะได้สร้างใหม่ได้
      try {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }
      } catch {}

      resizeObserverRef.current = null;

      try {
        if (mapRef.current) {
          mapRef.current.remove();
        }
      } catch {}

      mapRef.current = null;
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      originMarkerRef.current = null;
      destinationMarkerRef.current = null;
    };
  }, []);

  // =====================================================
  // CAPTURE IMAGE (บันทึกแผนที่เป็นรูป)
  // =====================================================

  useImperativeHandle(
    ref,
    () => ({
      captureImage: (info: SnapshotInfo) =>
        new Promise<string>((resolve, reject) => {
          const map = mapRef.current;
          const tileLayer = tileLayerRef.current;

          if (
            !map ||
            !tileLayer ||
            routeCoordinates.length === 0
          ) {
            reject(new Error('ยังไม่มีเส้นทางให้บันทึก'));
            return;
          }

          const hasRiskData =
            routeRiskPoints.length === routeCoordinates.length;

          const data = {
            route: routeCoordinates.map((p) => [
              p.latitude,
              p.longitude,
            ]),
            colors: hasRiskData
              ? routeRiskPoints.map((p) => p.color)
              : [],
            origin: originLocation
              ? [originLocation.lat, originLocation.lng]
              : null,
            dest: destinationLocation
              ? [
                  destinationLocation.lat,
                  destinationLocation.lng,
                ]
              : null,
            marks: highRiskMarkers.map((m) => [
              m.latitude,
              m.longitude,
              m.no,
              m.color,
            ]),
            info,
          };

          try {
            // ข้อความโค้ดชุดเดียวกับที่ฉีดเข้า WebView ฝั่งมือถือ
            const capture = new Function(
              'return (' + MAP_CAPTURE_SOURCE + ');'
            )();

            capture(
              map,
              tileLayer,
              data,
              (err: string | null, url: string | null) => {
                if (err || !url) {
                  reject(
                    new Error(err || 'แคปแผนที่ไม่สำเร็จ')
                  );
                } else {
                  resolve(url);
                }
              }
            );
          } catch (error) {
            reject(error as Error);
          }
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

    // ---------------------------------------------------
    // หมุดเลขจุดเสี่ยงสูง (วงกลมสีตามระดับ + วงรัศมี ให้เด่นกว่าเส้นทาง)
    // ---------------------------------------------------

    highRiskMarkers.forEach((m) => {
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
          '</div></div>',
      });

      const marker = L.marker([m.latitude, m.longitude], {
        icon,
        zIndexOffset: 1000,
        keyboard: false,
      }).addTo(map);

      // กดหมุดแล้วแสดงพิกัดและรายละเอียด (ใช้เทียบกับข้อมูล / Google Maps)
      const d: any = (m as any).detail;

      if (d) {
        const esc = (v: any) =>
          String(v ?? '-').replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]
          );
        const lat = m.latitude.toFixed(6);
        const lon = m.longitude.toFixed(6);

        marker.bindPopup(
          '<div style="font:13px sans-serif;line-height:1.6;min-width:260px;">' +
            '<b>จุดเสี่ยงที่ ' + esc(m.no) + ' · ' + esc(d.level) + '</b><br/>' +
            'ที่ตั้ง: <span id="rm-loc-' + esc(m.no) + '">กำลังค้นหาชื่อสถานที่...</span><br/>' +
            'จังหวัด: ' + esc(String(d.province || '').replace(/^จังหวัด/, '')) + '<br/>' +
            'สาเหตุหลัก: ' + esc(d.cause) + '<br/>' +
            'จำนวนอุบัติเหตุ: ' + esc(d.count) + ' ครั้ง<br/>' +
            'ล่าสุด: พ.ศ. ' + esc(Number(d.year) + 543) + '<br/>' +
            'พิกัด: <span style="user-select:all">' + lat + ', ' + lon + '</span>' +
            '<div style="width:260px;height:150px;margin-top:6px;border-radius:8px;overflow:hidden;background:#EAF7F3;">' +
              '<img src="' + SV_API + '/api/streetview?lat=' + lat + '&lng=' + lon + '&w=520&h=300" ' +
              'style="width:260px;height:150px;object-fit:cover;display:block;" ' +
              'onerror="this.parentNode.innerHTML=\'<div style=&quot;padding:10px;font:12px sans-serif;color:#4F6F6B&quot;>ไม่มีภาพ Street View บริเวณนี้</div>\'" />' +
            '</div>' +
            '<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + ',' + lon + '" target="_blank" rel="noopener" style="font-size:12px;">เปิด Street View เต็มจอ</a>' +
          '</div>'
        );
      }

      // ค้นชื่อถนน/ตำบล/อำเภอจากพิกัด ตอนเปิดกรอบ (OpenStreetMap)
      marker.on('popupopen', () => {
        const el = document.getElementById('rm-loc-' + m.no);
        if (!el) return;

        fetch(
          'https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=th' +
            '&zoom=18&lat=' + m.latitude + '&lon=' + m.longitude
        )
          .then((r) => r.json())
          .then((j) => {
            const a = j?.address || {};
            const parts = [
              a.road,
              a.neighbourhood || a.suburb || a.quarter || a.village || a.hamlet,
              a.city_district || a.county || a.district,
            ].filter(Boolean);
            el.textContent = parts.length ? parts.join(' · ') : (j?.display_name || 'ไม่พบชื่อสถานที่');
          })
          .catch(() => {
            el.textContent = 'ไม่พบชื่อสถานที่ (ใช้พิกัดด้านล่าง)';
          });
      });

      routeLayers.push(marker);
    });

    // ---------------------------------------------------
    // กล้องตรวจจับความเร็ว (ไอคอนกล้องสีม่วง กดดูรายละเอียดได้)
    // ---------------------------------------------------

    speedCameras.forEach((c) => {
      const icon = L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html:
          '<div style="width:26px;height:26px;border-radius:50%;background:#6A1B9A;' +
          'border:3px solid #fff;box-sizing:content-box;display:flex;align-items:center;' +
          'justify-content:center;font-size:14px;box-shadow:0 1px 4px rgba(0,0,0,0.4);">' +
          '\uD83D\uDCF7</div>',
      });

      const cm = L.marker([c.latitude, c.longitude], {
        icon,
        zIndexOffset: 800,
        keyboard: false,
      }).addTo(map);

      const esc2 = (v: any) =>
        String(v ?? '').replace(/[&<>"']/g, (ch) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[ch]
        );

      const kind = /red\s*light/i.test(c.name || '')
        ? 'กล้องจับฝ่าไฟแดง'
        : /traffic\s*camera/i.test(c.name || '')
        ? 'กล้องจราจร'
        : 'กล้องตรวจจับความเร็ว';
      const clat = c.latitude.toFixed(6);
      const clon = c.longitude.toFixed(6);

      cm.bindPopup(
        '<div style="font:13px sans-serif;line-height:1.6;min-width:260px;">' +
          '<b>' + kind + ' · จุดที่ ' + esc2(c.no) + '</b><br/>' +
          'ที่ตั้ง: <span id="cam-loc-' + esc2(c.no) + '">กำลังค้นหาชื่อสถานที่...</span><br/>' +
          'จังหวัด: <span id="cam-prov-' + esc2(c.no) + '">กำลังค้นหา...</span><br/>' +
          (c.speed_limit ? 'จำกัดความเร็ว: ' + esc2(c.speed_limit) + ' กม./ชม.<br/>' : 'จำกัดความเร็ว: ไม่มีข้อมูล<br/>') +
          'ห่างจากต้นทางประมาณ ' + esc2(c.km_from_start) + ' กม.<br/>' +
          'พิกัด: <span style="user-select:all">' + clat + ', ' + clon + '</span>' +
          '<div style="width:260px;height:150px;margin-top:6px;border-radius:8px;overflow:hidden;background:#EAF7F3;">' +
            '<img src="' + SV_API + '/api/streetview?lat=' + clat + '&lng=' + clon + '&w=520&h=300" ' +
            'style="width:260px;height:150px;object-fit:cover;display:block;" ' +
            'onerror="this.parentNode.innerHTML=\'<div style=&quot;padding:10px;font:12px sans-serif;color:#4F6F6B&quot;>ไม่มีภาพ Street View บริเวณนี้</div>\'" />' +
          '</div>' +
          '<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + clat + ',' + clon + '" target="_blank" rel="noopener" style="font-size:12px;">เปิด Street View เต็มจอ</a>' +
          '<div style="font-size:11px;color:#7A8F8B;margin-top:4px;">ตำแหน่งจาก OpenStreetMap อาจคลาดเคลื่อนหรือไม่ครบทุกจุด</div>' +
        '</div>'
      );

      // ค้นชื่อถนน/ตำบล/อำเภอ/จังหวัดจากพิกัด ตอนเปิดกรอบ (OpenStreetMap)
      cm.on('popupopen', () => {
        const el = document.getElementById('cam-loc-' + c.no);
        const pv = document.getElementById('cam-prov-' + c.no);
        if (!el) return;

        fetch(
          'https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=th' +
            '&zoom=18&lat=' + c.latitude + '&lon=' + c.longitude
        )
          .then((r) => r.json())
          .then((j) => {
            const a = j?.address || {};
            const parts = [
              a.road,
              a.neighbourhood || a.suburb || a.quarter || a.village || a.hamlet,
              a.city_district || a.county || a.district,
            ].filter(Boolean);
            el.textContent = parts.length ? parts.join(' · ') : (j?.display_name || 'ไม่พบชื่อสถานที่');
            if (pv) pv.textContent = String(a.state || a.province || '-').replace(/^จังหวัด/, '');
          })
          .catch(() => {
            el.textContent = 'ไม่พบชื่อสถานที่ (ใช้พิกัดด้านล่าง)';
            if (pv) pv.textContent = '-';
          });
      });

      routeLayers.push(cm);
    });

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

    // ===================================================
    // FORCE INVALIDATE SIZE
    // ===================================================

    setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 300);

  }, [
    mapReady,
    routeCoordinates,
    routeRiskPoints,
    originLocation,
    destinationLocation,
    highRiskMarkers,
    speedCameras,
  ]);

  // =====================================================
  // USER GPS DOT (จุดฟ้าตามตำแหน่งจริง ไม่ทำให้เส้นทางวาดใหม่)
  // =====================================================

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;

    if (!mapReady || !L || !map) {
      return;
    }

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (userAccuracyRef.current) {
        map.removeLayer(userAccuracyRef.current);
        userAccuracyRef.current = null;
      }
      return;
    }

    const latlng: [number, number] = [userLocation.lat, userLocation.lng];

    if (!document.getElementById('user-dot-style')) {
      const st = document.createElement('style');
      st.id = 'user-dot-style';
      st.innerHTML =
        '@keyframes userPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(3);opacity:0}}';
      document.head.appendChild(st);
    }

    if (!userMarkerRef.current) {
      const icon = L.divIcon({
        className: 'safe-route-user-dot',
        html:
          '<div style="position:relative;width:18px;height:18px">' +
          '<div style="position:absolute;inset:0;border-radius:50%;background:#2196F3;animation:userPulse 1.8s ease-out infinite"></div>' +
          '<div style="position:absolute;inset:0;border-radius:50%;background:#2196F3;border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>' +
          '</div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      userMarkerRef.current = L.marker(latlng, {
        icon,
        zIndexOffset: 2000,
      })
        .addTo(map)
        .bindPopup('<b>ตำแหน่งของคุณ</b>');
    } else {
      userMarkerRef.current.setLatLng(latlng);
    }

    const acc = userLocation.accuracy;
    if (acc && acc > 0 && acc < 2000) {
      if (!userAccuracyRef.current) {
        userAccuracyRef.current = L.circle(latlng, {
          radius: acc,
          color: '#2196F3',
          weight: 1,
          fillColor: '#2196F3',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
      } else {
        userAccuracyRef.current.setLatLng(latlng);
        userAccuracyRef.current.setRadius(acc);
      }
    }
  }, [mapReady, userLocation]);

  // เลื่อนแผนที่ไปที่ผู้ใช้เมื่อกดปุ่มระบุตำแหน่ง / ได้ตำแหน่งแรก
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !focusUserToken || !userLocation) {
      return;
    }
    map.setView([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 15));
  }, [mapReady, focusUserToken]);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <View
      style={styles.container}
    >
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </View>
  );
});

export default AppMap;

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