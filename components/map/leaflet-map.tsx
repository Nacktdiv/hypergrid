import React, { useMemo, useRef, useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import type { DamagePoint, MapData } from "./map-data";
import { VEHICLE_MARKER_IMAGES } from "./vehicle-assets-base64";

export type LeafletMapProps = {
  data: MapData;
  vehicleType?: "car" | "motor" | "bicycle";
  /** Matikan gestur pan/zoom — untuk peta ringkas di riwayat */
  interactive?: boolean;
  /** Callback saat titik kerusakan ditekan */
  onDamagePress?: (point: DamagePoint) => void;
};

const WebViewComponent = WebView as any;

export const LeafletMap = React.memo(function LeafletMap({
  data,
  vehicleType = "car",
  interactive = true,
  onDamagePress,
}: LeafletMapProps) {
  const webViewRef = useRef<any>(null);
  const isMapLoaded = useRef<boolean>(false);
  const lastInjectedPos = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteLengthRef = useRef<number>(0);
  const lastDamageJsonRef = useRef<string>("");

  // Simpan data awal saat pertama kali mount
  const [initialData] = useState<MapData>(data);

  // Buat HTML Leaflet sekali dengan titik awal nyata
  const htmlContent = useMemo(() => {
    const { camera, route, damagePoints, vehiclePosition } =
      initialData;
    const centerLat = camera.latitude;
    const centerLng = camera.longitude;
    const zoomLevel = Math.max(12, Math.min(18, Math.round(camera.zoom)));

    const routeCoords = JSON.stringify(
      route.coordinates.map((c) => [c.latitude, c.longitude])
    );
    const damageData = JSON.stringify(damagePoints);
    const vehicleCoord = JSON.stringify([
      vehiclePosition.latitude,
      vehiclePosition.longitude,
    ]);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; background: #f8fafc; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .damage-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px !important;
      height: 34px !important;
      border-radius: 50%;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      border: 2px solid #ffffff;
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    .damage-marker:active {
      transform: scale(1.15);
    }
    .severity-high { background-color: #EF4444; }
    .severity-medium { background-color: #F59E0B; }
    .severity-low { background-color: #EAB308; color: #1e293b; }

    .user-marker {
      width: 20px !important;
      height: 20px !important;
      border-radius: 50%;
      background-color: #009EFF;
      border: 3px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }

    .vehicle-marker-wrapper {
      width: 48px !important;
      height: 48px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }

    .vehicle-marker-img {
      width: 46px;
      height: 46px;
      object-fit: contain;
      filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4));
    }
    .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(255,255,255,0.7) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      window.map = L.map('map', {
        center: [${centerLat}, ${centerLng}],
        zoom: ${zoomLevel},
        zoomControl: false,
        dragging: ${interactive ? "true" : "false"},
        touchZoom: ${interactive ? "true" : "false"},
        doubleClickZoom: ${interactive ? "true" : "false"},
        scrollWheelZoom: ${interactive ? "true" : "false"},
        attributionControl: false
      });

      // OpenStreetMap Standard Tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(window.map);

      // Route Polyline
      var initialRoute = ${routeCoords};
      window.routePolyline = null;
      if (initialRoute && initialRoute.length > 0) {
        window.routePolyline = L.polyline(initialRoute, {
          color: '#009EFF',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(window.map);
      }

      // Damage Clusters Layer
      window.damageLayer = L.layerGroup().addTo(window.map);
      window.renderDamagePoints = function(points) {
        window.damageLayer.clearLayers();
        points.forEach(function(pt) {
          var sevClass = pt.severity === 'high' ? 'severity-high' : (pt.severity === 'medium' ? 'severity-medium' : 'severity-low');
          var html = '<div class="damage-marker ' + sevClass + '">' + pt.reportCount + '</div>';
          var icon = L.divIcon({
            className: '',
            html: html,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          var marker = L.marker([pt.position.latitude, pt.position.longitude], { icon: icon });
          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DAMAGE_PRESS',
                point: pt
              }));
            }
          });
          window.damageLayer.addLayer(marker);
        });
      };
      window.renderDamagePoints(${damageData});

      // Vehicle graphic markers
      var vehicleImages = ${JSON.stringify(VEHICLE_MARKER_IMAGES)};
      var initialImg = vehicleImages["${vehicleType}"] || vehicleImages["car"];
      var vehicleIcon = L.divIcon({
        className: '',
        html: '<div class="vehicle-marker-wrapper"><img class="vehicle-marker-img" src="' + initialImg + '" alt="vehicle" /></div>',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
      window.vehicleMarker = L.marker(${vehicleCoord}, { icon: vehicleIcon }).addTo(window.map);

      // Helper untuk mengganti ikon gambar kendaraan secara real-time
      window.setVehicleType = function(vType) {
        var imgSrc = vehicleImages[vType] || vehicleImages["car"];
        var newIcon = L.divIcon({
          className: '',
          html: '<div class="vehicle-marker-wrapper"><img class="vehicle-marker-img" src="' + imgSrc + '" alt="vehicle" /></div>',
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });
        if (window.vehicleMarker) {
          window.vehicleMarker.setIcon(newIcon);
        }
      };

      // Helper pembaruan real-time dinamis (tanpa me-reload seluruh halaman)
      window.updatePosition = function(lat, lng) {
        if (window.vehicleMarker) window.vehicleMarker.setLatLng([lat, lng]);
        if (window.map) window.map.panTo([lat, lng], { animate: true, duration: 0.6 });
      };

      window.updateRoute = function(coords) {
        if (window.routePolyline) {
          window.routePolyline.setLatLngs(coords);
        } else if (coords && coords.length > 0) {
          window.routePolyline = L.polyline(coords, {
            color: '#009EFF',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(window.map);
        }
      };

      // Beritahu React Native bahwa map sudah siap menerima event dinamis
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    } catch (e) {
      console.error(e);
    }
  </script>
</body>
</html>
    `;
  }, [initialData, interactive, vehicleType]);

  // Pembaruan ikon kendaraan seketika saat user memilih jenis kendaraan baru di main page
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;
    const js = `
      if (window.setVehicleType) window.setVehicleType('${vehicleType}');
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [vehicleType]);

  // 1. Pembaruan posisi kendaraan via injectJavaScript (Ultra-smooth, no reload, O(1) string)
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;

    const lat = data.vehiclePosition.latitude;
    const lng = data.vehiclePosition.longitude;

    if (
      lastInjectedPos.current &&
      Math.abs(lastInjectedPos.current.lat - lat) < 0.000003 &&
      Math.abs(lastInjectedPos.current.lng - lng) < 0.000003
    ) {
      return;
    }
    lastInjectedPos.current = { lat, lng };

    const js = `
      if (window.updatePosition) window.updatePosition(${lat}, ${lng});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [data.vehiclePosition.latitude, data.vehiclePosition.longitude]);

  // 2. Pembaruan jejak rute perjalanan (hanya dieksekusi saat titik rute bertambah)
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;

    const coords = data.route.coordinates;
    if (coords.length === lastRouteLengthRef.current && coords.length > 0) {
      return;
    }
    lastRouteLengthRef.current = coords.length;

    const routeJson = JSON.stringify(
      coords.map((c) => [c.latitude, c.longitude])
    );
    const js = `
      if (window.updateRoute) window.updateRoute(${routeJson});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [data.route.coordinates]);

  // 3. Pembaruan titik klaster kerusakan jalan (HANYA saat data kerusakan berubah)
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;

    const damageJson = JSON.stringify(data.damagePoints);
    if (damageJson === lastDamageJsonRef.current) {
      return;
    }
    lastDamageJsonRef.current = damageJson;

    const js = `
      if (window.renderDamagePoints) window.renderDamagePoints(${damageJson});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [data.damagePoints]);

  const handleMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === "MAP_READY") {
        isMapLoaded.current = true;
        // Langsung sinkronkan posisi saat ini begitu map siap
        const lat = data.vehiclePosition.latitude;
        const lng = data.vehiclePosition.longitude;
        const routeJson = JSON.stringify(
          data.route.coordinates.map((c) => [c.latitude, c.longitude])
        );
        webViewRef.current?.injectJavaScript(`
          if (window.updatePosition) window.updatePosition(${lat}, ${lng});
          if (window.updateRoute) window.updateRoute(${routeJson});
          true;
        `);
      } else if (payload.type === "DAMAGE_PRESS" && onDamagePress) {
        onDamagePress(payload.point);
      }
    } catch {
      // Abaikan parsing error
    }
  };

  return (
    <View style={styles.container}>
      <WebViewComponent
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={styles.webView}
        scrollEnabled={false}
        overScrollMode="never"
        onMessage={handleMessage}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#009EFF" />
          </View>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: "100%",
    width: "100%",
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
    opacity: 0.99,
  },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
});
