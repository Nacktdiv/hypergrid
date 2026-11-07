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
  const lastHeatmapJsonRef = useRef<string>("");
  const lastActiveClusterIdRef = useRef<string | null>(null);

  // Simpan data awal saat pertama kali mount
  const [initialData] = useState<MapData>(data);

  // Buat HTML Leaflet sekali dengan titik awal nyata
  const htmlContent = useMemo(() => {
    const { camera, route, damagePoints, vehiclePosition, heatmap, activeClusterId } =
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
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
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
    .severity-severe { background-color: #991B1B; }
    .severity-high { background-color: #EF4444; }
    .severity-medium { background-color: #F59E0B; }
    .severity-low { background-color: #EAB308; color: #1e293b; }

    @keyframes pulseRadarArea {
      0% { fill-opacity: 0.35; stroke-opacity: 0.9; stroke-width: 2px; }
      50% { fill-opacity: 0.12; stroke-opacity: 0.45; stroke-width: 3.5px; }
      100% { fill-opacity: 0.35; stroke-opacity: 0.9; stroke-width: 2px; }
    }
    .cluster-highlight-circle {
      animation: pulseRadarArea 2s infinite ease-in-out;
    }

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
      // Inisialisasi fallback L.heatLayer jika CDN gagal dimuat saat offline
      if (typeof L.heatLayer !== 'function') {
        L.heatLayer = function(latlngs, opts) {
          var layer = L.layerGroup();
          var radius = (opts && opts.radius) || 20;
          latlngs.forEach(function(p) {
            var lat = p[0], lng = p[1], intensity = p[2] || 0.6;
            var col = intensity > 0.8 ? '#EF4444' : (intensity > 0.5 ? '#F59E0B' : '#009EFF');
            var c = L.circleMarker([lat, lng], {
              radius: radius * 0.4,
              color: 'transparent',
              fillColor: col,
              fillOpacity: Math.min(0.7, intensity * 0.6)
            });
            layer.addLayer(c);
          });
          return layer;
        };
      }

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

      // 1. Dedicated pane untuk user vehicle marker agar selalu di paling atas
      window.map.createPane('vehicleTopPane');
      window.map.getPane('vehicleTopPane').style.zIndex = '999';
      window.map.getPane('vehicleTopPane').style.pointerEvents = 'none';

      // 2. Global Heatmap Layer (Visualisasi sebaran intensitas kerusakan jalan)
      window.heatLayer = null;
      window.updateHeatmap = function(heatData) {
        if (window.heatLayer) {
          window.map.removeLayer(window.heatLayer);
          window.heatLayer = null;
        }
        if (heatData && heatData.length > 0 && typeof L.heatLayer === 'function') {
          window.heatLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 16,
            maxZoom: 18,
            minOpacity: 0.35,
            gradient: { 0.2: '#009EFF', 0.5: '#EAB308', 0.75: '#F59E0B', 1.0: '#EF4444' }
          }).addTo(window.map);
        }
      };
      var initialHeat = ${JSON.stringify(heatmap || [])};
      window.updateHeatmap(initialHeat);

      // 3. Cluster Area Highlight Layer (Highlight area heatmap & radius cakupan 1 klaster saat diklik)
      window.clusterHighlightLayer = L.layerGroup().addTo(window.map);
      window.highlightCluster = function(pt) {
        window.clusterHighlightLayer.clearLayers();
        if (!pt || !pt.position) return;

        var lat = pt.position.latitude;
        var lng = pt.position.longitude;
        var radius = pt.radius_meters || 18;
        var sevColor = pt.severity === 'severe' ? '#991B1B' : (pt.severity === 'high' ? '#EF4444' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));

        // Lingkaran radar area cakupan klaster
        var circle = L.circle([lat, lng], {
          radius: radius,
          color: sevColor,
          weight: 2.5,
          opacity: 0.9,
          fillColor: sevColor,
          fillOpacity: 0.26,
          dashArray: '5, 5',
          className: 'cluster-highlight-circle'
        });
        window.clusterHighlightLayer.addLayer(circle);

        // Titik-titik mikro penyusun klaster (jika ada data points)
        if (pt.points && pt.points.length > 0) {
          pt.points.forEach(function(sub) {
            var dot = L.circleMarker([sub.latitude, sub.longitude], {
              radius: 5,
              color: '#ffffff',
              weight: 1.5,
              fillColor: '#FF1E44',
              fillOpacity: 0.95
            });
            window.clusterHighlightLayer.addLayer(dot);
          });
        }

        window.map.panTo([lat, lng], { animate: true, duration: 0.5 });
      };

      // 4. Damage Clusters Layer (Titik Tunggal Representatif Hasil DBSCAN)
      window.damageLayer = L.layerGroup().addTo(window.map);
      window.renderDamagePoints = function(points) {
        window.damageLayer.clearLayers();
        points.forEach(function(pt) {
          var sevClass = pt.severity === 'severe' ? 'severity-severe' : (pt.severity === 'high' ? 'severity-high' : (pt.severity === 'medium' ? 'severity-medium' : 'severity-low'));
          var html = '<div class="damage-marker ' + sevClass + '">' + pt.reportCount + '</div>';
          var icon = L.divIcon({
            className: '',
            html: html,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          var marker = L.marker([pt.position.latitude, pt.position.longitude], {
            icon: icon,
            zIndexOffset: 100
          });
          marker.on('click', function() {
            // Highlight area cakupan klaster langsung di map
            window.highlightCluster(pt);
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

      // Vehicle graphic markers (placed in vehicleTopPane & highest zIndexOffset so never covered by clusters)
      var vehicleImages = ${JSON.stringify(VEHICLE_MARKER_IMAGES)};
      var initialImg = vehicleImages["${vehicleType}"] || vehicleImages["car"];
      var vehicleIcon = L.divIcon({
        className: '',
        html: '<div class="vehicle-marker-wrapper"><img class="vehicle-marker-img" src="' + initialImg + '" alt="vehicle" /></div>',
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
      window.vehicleMarker = L.marker(${vehicleCoord}, {
        icon: vehicleIcon,
        pane: 'vehicleTopPane',
        zIndexOffset: 10000
      }).addTo(window.map);

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
          if (window.vehicleMarker.setZIndexOffset) {
            window.vehicleMarker.setZIndexOffset(10000);
          }
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

  // 4. Pembaruan data heatmap global secara in-place
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;

    const heatJson = JSON.stringify(data.heatmap || []);
    if (heatJson === lastHeatmapJsonRef.current) return;
    lastHeatmapJsonRef.current = heatJson;

    const js = `
      if (window.updateHeatmap) window.updateHeatmap(${heatJson});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [data.heatmap]);

  // 4b. Pembaruan rute navigasi perjalanan secara real-time
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;
    const routeCoords = data.route?.coordinates || [];
    const routeJson = JSON.stringify(
      routeCoords.map((c) => [c.latitude, c.longitude])
    );
    const js = `
      if (window.updateRoute) window.updateRoute(${routeJson});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [data.route?.coordinates]);

  // 5. Pembaruan highlight cakupan area klaster saat user memilih klaster
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;

    if (data.activeClusterId === lastActiveClusterIdRef.current) return;
    lastActiveClusterIdRef.current = data.activeClusterId ?? null;

    if (data.activeClusterId) {
      const activePt = data.damagePoints.find(
        (p) => p.id === data.activeClusterId
      );
      const activeJson = JSON.stringify(activePt || null);
      const js = `
        if (window.highlightCluster) window.highlightCluster(${activeJson});
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    } else {
      const js = `
        if (window.highlightCluster) window.highlightCluster(null);
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [data.activeClusterId, data.damagePoints]);

  const handleMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === "MAP_READY") {
        isMapLoaded.current = true;
        // Langsung sinkronkan posisi, rute, dan heatmap saat ini begitu map siap
        const lat = data.vehiclePosition.latitude;
        const lng = data.vehiclePosition.longitude;
        const routeJson = JSON.stringify(
          data.route.coordinates.map((c) => [c.latitude, c.longitude])
        );
        const heatJson = JSON.stringify(data.heatmap || []);
        const activePt = data.activeClusterId
          ? data.damagePoints.find((p) => p.id === data.activeClusterId)
          : null;
        const activeJson = JSON.stringify(activePt || null);

        webViewRef.current?.injectJavaScript(`
          if (window.updatePosition) window.updatePosition(${lat}, ${lng});
          if (window.updateRoute) window.updateRoute(${routeJson});
          if (window.updateHeatmap) window.updateHeatmap(${heatJson});
          if (${activeJson}) window.highlightCluster(${activeJson});
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
