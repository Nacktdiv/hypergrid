import React, { useMemo, useRef, useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import type { DamagePoint, MapData } from "./map-data";

export type LeafletMapProps = {
  data: MapData;
  vehicleType?: "car" | "motor" | "bicycle";
  /** Matikan gestur pan/zoom — untuk peta ringkas di riwayat */
  interactive?: boolean;
  /** Callback saat titik kerusakan ditekan */
  onDamagePress?: (point: DamagePoint) => void;
};

const WebViewComponent = WebView as any;

export function LeafletMap({
  data,
  vehicleType = "car",
  interactive = true,
  onDamagePress,
}: LeafletMapProps) {
  const webViewRef = useRef<any>(null);
  const isMapLoaded = useRef<boolean>(false);
  const lastInjectedPos = useRef<{ lat: number; lng: number } | null>(null);

  // Simpan data awal saat pertama kali mount
  const [initialData] = useState<MapData>(data);

  // Buat HTML Leaflet sekali dengan titik awal nyata
  const htmlContent = useMemo(() => {
    const { camera, route, damagePoints, userLocation, vehiclePosition } =
      initialData;
    const centerLat = camera.latitude;
    const centerLng = camera.longitude;
    const zoomLevel = Math.max(12, Math.min(18, Math.round(camera.zoom)));

    const routeCoords = JSON.stringify(
      route.coordinates.map((c) => [c.latitude, c.longitude])
    );
    const damageData = JSON.stringify(damagePoints);
    const userCoord = JSON.stringify([
      userLocation.latitude,
      userLocation.longitude,
    ]);
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

    .vehicle-marker {
      width: 38px !important;
      height: 38px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0F172A;
      color: #38BDF8;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      font-size: 18px;
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
        zoomControl: ${interactive ? "true" : "false"},
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

      // User Marker
      var userIcon = L.divIcon({
        className: '',
        html: '<div class="user-marker"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      window.userMarker = L.marker(${userCoord}, { icon: userIcon }).addTo(window.map);

      // Vehicle Marker
      var vehicleEmoji = "${vehicleType === "motor" ? "🏍️" : vehicleType === "bicycle" ? "🚲" : "🚗"}";
      var vehicleIcon = L.divIcon({
        className: '',
        html: '<div class="vehicle-marker">' + vehicleEmoji + '</div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      window.vehicleMarker = L.marker(${vehicleCoord}, { icon: vehicleIcon }).addTo(window.map);

      // Helper pembaruan real-time dinamis (tanpa me-reload seluruh halaman)
      window.updatePosition = function(lat, lng) {
        if (window.vehicleMarker) window.vehicleMarker.setLatLng([lat, lng]);
        if (window.userMarker) window.userMarker.setLatLng([lat, lng]);
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

  // Pembaruan posisi kendaraan & jejak rute via injectJavaScript (Ultra-smooth, no reload)
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

    const routeJson = JSON.stringify(
      data.route.coordinates.map((c) => [c.latitude, c.longitude])
    );
    const damageJson = JSON.stringify(data.damagePoints);

    const js = `
      if (window.updatePosition) window.updatePosition(${lat}, ${lng});
      if (window.updateRoute) window.updateRoute(${routeJson});
      if (window.renderDamagePoints) window.renderDamagePoints(${damageJson});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [
    data.vehiclePosition.latitude,
    data.vehiclePosition.longitude,
    data.route.coordinates,
    data.damagePoints,
  ]);

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
}

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
