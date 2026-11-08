import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { AreaSummary, DamagePoint, MapData } from "./map-data";
import { VEHICLE_MARKER_IMAGES } from "./vehicle-assets-base64";

export type LeafletMapProps = {
  data: MapData;
  vehicleType?: "car" | "motor" | "bicycle";
  /** Matikan gestur pan/zoom — untuk peta ringkas di riwayat */
  interactive?: boolean;
  /** Koordinat untuk fokus/flyTo ke lokasi tertentu */
  focusCoords?: { latitude: number; longitude: number; zoom?: number } | null;
  /** Callback saat titik kerusakan ditekan */
  onDamagePress?: (point: DamagePoint) => void;
  /** Callback saat titik ringkasan area makro (~1 km) ditekan */
  onAreaSummaryPress?: (area: AreaSummary) => void;
};

const WebViewComponent = WebView as any;

export const LeafletMap = React.memo(function LeafletMap({
  data,
  vehicleType = "car",
  interactive = true,
  focusCoords,
  onDamagePress,
  onAreaSummaryPress,
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
    const { camera, route, damagePoints, vehiclePosition, heatmap } =
      initialData;
    const centerLat = camera.latitude;
    const centerLng = camera.longitude;
    const zoomLevel = Math.max(12, Math.min(18, Math.round(camera.zoom)));

    const routeCoords = JSON.stringify(
      route.coordinates.map((c) => [c.latitude, c.longitude]),
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

    /* 1. Macro Badge (Tampilan Jauh zoom < 15): Hanya Angka dan Warna */
    .macro-badge-compact {
      width: 32px !important;
      height: 32px !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 800;
      font-size: 13px;
      line-height: 1;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
      border: 2.5px solid #ffffff;
      cursor: pointer;
      transition: transform 0.15s ease;
      user-select: none;
    }
    .macro-badge-compact:active {
      transform: scale(1.18);
    }
    .macro-badge-compact.severity-severe { background-color: #991B1B; }
    .macro-badge-compact.severity-high { background-color: #EF4444; }
    .macro-badge-compact.severity-medium { background-color: #F59E0B; }
    .macro-badge-compact.severity-low { background-color: #EAB308; color: #0f172a; }

    /* 2. Location Pin Marker (Badge bentuk icon lokasi): Muncul saat ruas jalan diklik atau zoom >= 17 */
    .location-pin-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45));
      cursor: pointer;
      transition: transform 0.15s ease;
      user-select: none;
    }
    .location-pin-marker:active {
      transform: scale(1.22) translateY(-2px);
    }

    .road-corridor-glow {
      animation: pulseCorridor 2.5s infinite ease-in-out;
    }
    @keyframes pulseCorridor {
      0% { opacity: 0.48; }
      50% { opacity: 0.20; }
      100% { opacity: 0.48; }
    }

    .user-marker {
      width: 20px !important;
      height: 20px !important;
      border-radius: 50%;
      background-color: #0040FF;
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
            var col = intensity > 0.8 ? '#EF4444' : (intensity > 0.5 ? '#F59E0B' : '#0040FF');
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
          color: '#0040FF',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(window.map);
      }

      // 1. Dedicated pane untuk user vehicle marker agar selalu di paling atas
      window.map.createPane('vehicleTopPane');
      window.map.getPane('vehicleTopPane').style.zIndex = '999';
      window.map.getPane('vehicleTopPane').style.pointerEvents = 'none';

      // 2. State & Layer Groups untuk Multi-Level LOD
      // LOD 1 (Jauh, zoom < 15): Ruas Panjang Jalan & Badge Makro (Angka & Warna)
      // LOD 2 (Agak Jauh, 15 <= zoom < 17): Heatmap Seruas Jalan Saja
      // LOD 3 (Dekat, zoom >= 17): Seluruh Titik Kerusakan dengan Badge Icon Lokasi
      window.areaSummaryLayer = L.layerGroup().addTo(window.map);
      window.activeRoadSegmentLayer = L.layerGroup().addTo(window.map);
      window.clusterHighlightLayer = L.layerGroup().addTo(window.map);
      window.damageLayer = L.layerGroup().addTo(window.map);
      window.heatLayer = null;

      window.rawDamagePoints = ${damageData} || [];
      window.rawHeatData = ${JSON.stringify(heatmap || [])};
      window.activeRoadSegments = [];

      function haversineM(lat1, lon1, lat2, lon2) {
        var R = 6371000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      // Helper membuat SVG Badge Icon Lokasi (Map Pin)
      function createLocationPinSvg(sevColor, count) {
        var innerContent = (count && count > 1)
          ? '<text x="12" y="15" text-anchor="middle" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="900" fill="#ffffff">' + count + '</text>'
          : '<circle cx="12" cy="11.5" r="4.2" fill="#ffffff"/>';

        return '<svg width="26" height="34" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M12 0C5.372 0 0 5.372 0 12C0 19.8 12 32 12 32C12 32 24 19.8 24 12C24 5.372 18.628 0 12 0Z" fill="' + sevColor + '" stroke="#ffffff" stroke-width="2"/>' +
          innerContent +
          '</svg>';
      }

      // Algoritma pengelompokan ruas panjang jalan (Road Segment Chaining, bukan rasio grid bujur sangkar atau radius lingkaran)
      function computeRoadSegmentAreas(points) {
        if (!points || points.length === 0) return [];
        var unassigned = points.slice();
        var segments = [];
        var segId = 1;

        while (unassigned.length > 0) {
          var startPt = unassigned.shift();
          var segClusters = [startPt];
          var segPolyline = [{ lat: startPt.position.latitude, lng: startPt.position.longitude }];
          var accLength = startPt.road_length_meters || 15;

          var expanded = true;
          while (expanded && unassigned.length > 0) {
            expanded = false;
            var head = segPolyline[0];
            var tail = segPolyline[segPolyline.length - 1];

            var bestIdx = -1;
            var bestDist = Infinity;
            var attachToTail = true;

            for (var i = 0; i < unassigned.length; i++) {
              var cand = unassigned[i].position;
              var dTail = haversineM(tail.lat, tail.lng, cand.latitude, cand.longitude);
              var dHead = haversineM(head.lat, head.lng, cand.latitude, cand.longitude);

              if (dTail < bestDist && dTail <= 250) {
                bestDist = dTail;
                bestIdx = i;
                attachToTail = true;
              }
              if (dHead < bestDist && dHead <= 250) {
                bestDist = dHead;
                bestIdx = i;
                attachToTail = false;
              }
            }

            if (bestIdx !== -1 && bestDist <= 250) {
              var nextPt = unassigned[bestIdx];
              var addLen = bestDist + (nextPt.road_length_meters || 15);
              if (accLength + addLen <= 1350) {
                unassigned.splice(bestIdx, 1);
                segClusters.push(nextPt);
                accLength += addLen;
                if (attachToTail) {
                  segPolyline.push({ lat: nextPt.position.latitude, lng: nextPt.position.longitude });
                } else {
                  segPolyline.unshift({ lat: nextPt.position.latitude, lng: nextPt.position.longitude });
                }
                expanded = true;
              }
            }
          }

          if (segPolyline.length === 1) {
            var sp = segPolyline[0];
            segPolyline.unshift({ lat: sp.lat - 0.00012, lng: sp.lng });
            segPolyline.push({ lat: sp.lat + 0.00012, lng: sp.lng });
          }

          var sLat = 0, sLng = 0, totalRep = 0;
          var counts = { severe: 0, high: 0, medium: 0, low: 0 };
          for (var j = 0; j < segClusters.length; j++) {
            var cp = segClusters[j];
            sLat += cp.position.latitude;
            sLng += cp.position.longitude;
            totalRep += (cp.reportCount || 1);
            if (counts[cp.severity] !== undefined) counts[cp.severity]++;
          }

          var worst = 'low';
          if (counts.severe > 0) worst = 'severe';
          else if (counts.high > 0) worst = 'high';
          else if (counts.medium > 0) worst = 'medium';

          segments.push({
            id: 'road-seg-' + (segId++),
            center: { latitude: sLat / segClusters.length, longitude: sLng / segClusters.length },
            roadLengthMeters: Math.max(25, Math.round(accLength)),
            roadPolyline: segPolyline,
            clusterCount: segClusters.length,
            totalReports: totalRep,
            worstSeverity: worst,
            severityCounts: counts,
            clusters: segClusters
          });
        }
        return segments;
      }

      // Pembuatan Layer Heatmap Ringkas Seruas Jalan (radius: 11, blur: 6)
      window.createHeatmapLayer = function(heatData) {
        if (!heatData || heatData.length === 0 || typeof L.heatLayer !== 'function') return null;
        return L.heatLayer(heatData, {
          radius: 11,
          blur: 6,
          maxZoom: 18,
          minOpacity: 0.35,
          gradient: { 0.2: '#0040FF', 0.5: '#EAB308', 0.75: '#F59E0B', 1.0: '#EF4444' }
        });
      };

      // 1. Render Titik Ringkasan Ruas Jalan Makro: HANYA ANGKA dan WARNA (tanpa detail teks panjang)
      window.renderAreaSummaryMarkers = function(areas) {
        window.areaSummaryLayer.clearLayers();
        areas.forEach(function(area) {
          var sevClass = area.worstSeverity === 'severe' ? 'severity-severe' : (area.worstSeverity === 'high' ? 'severity-high' : (area.worstSeverity === 'medium' ? 'severity-medium' : 'severity-low'));
          var html = '<div class="macro-badge-compact ' + sevClass + '">' + area.clusterCount + '</div>';
          var icon = L.divIcon({
            className: '',
            html: html,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          var marker = L.marker([area.center.latitude, area.center.longitude], {
            icon: icon,
            zIndexOffset: 80
          });
          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            window.highlightRoadSegment(area);
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'AREA_SUMMARY_PRESS',
                area: area
              }));
            }
          });
          window.areaSummaryLayer.addLayer(marker);
        });
      };

      // 2. Tampilkan Area Panjang Jalan dalam Klaster & Titik-Titik Lokasi Kerusakan dengan Badge Icon Lokasi
      window.highlightRoadSegment = function(area) {
        window.activeRoadSegmentLayer.clearLayers();
        if (!area) return;

        var sevColor = area.worstSeverity === 'severe' ? '#991B1B' : (area.worstSeverity === 'high' ? '#EF4444' : (area.worstSeverity === 'medium' ? '#F59E0B' : '#EAB308'));

        // A. Gambar Garis Koridor Area Panjang Jalan (Road Segment Polyline)
        if (area.roadPolyline && area.roadPolyline.length > 1) {
          var polyCoords = area.roadPolyline.map(function(p) { return [p.lat || p.latitude, p.lng || p.longitude]; });

          // Garis Koridor Luar Berdenyut (Road corridor glow buffer)
          var corridorGlow = L.polyline(polyCoords, {
            color: sevColor,
            weight: 14,
            opacity: 0.42,
            lineCap: 'round',
            lineJoin: 'round',
            className: 'road-corridor-glow'
          });
          window.activeRoadSegmentLayer.addLayer(corridorGlow);

          // Garis Inti Jalan (Road center track)
          var corridorCore = L.polyline(polyCoords, {
            color: sevColor,
            weight: 4.5,
            opacity: 0.95,
            dashArray: '8, 6',
            lineCap: 'round',
            lineJoin: 'round'
          });
          window.activeRoadSegmentLayer.addLayer(corridorCore);

          try {
            window.map.fitBounds(corridorGlow.getBounds(), { padding: [45, 45], maxZoom: 16.5, animate: true });
          } catch(e) {}
        }

        // B. Tampilkan Titik-Titik Lokasi Kerusakan dengan Badge Bentuk Icon Lokasi (Map Pin SVG)
        if (area.clusters && area.clusters.length > 0) {
          area.clusters.forEach(function(pt) {
            var ptSevColor = pt.severity === 'severe' ? '#991B1B' : (pt.severity === 'high' ? '#EF4444' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));
            var pinSvg = createLocationPinSvg(ptSevColor, pt.reportCount);
            var pinHtml = '<div class="location-pin-marker">' + pinSvg + '</div>';
            var pinIcon = L.divIcon({
              className: '',
              html: pinHtml,
              iconSize: [26, 34],
              iconAnchor: [13, 34]
            });
            var pinMarker = L.marker([pt.position.latitude, pt.position.longitude], {
              icon: pinIcon,
              zIndexOffset: 300
            });

            // Ketika icon lokasi dipencet lagi: buka modal Road Damage Details!
            pinMarker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              window.highlightCluster(pt);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DAMAGE_PRESS',
                  point: pt
                }));
              }
            });
            window.activeRoadSegmentLayer.addLayer(pinMarker);
          });
        }
      };

      window.clearRoadSegmentHighlight = function() {
        window.activeRoadSegmentLayer.clearLayers();
      };

      window.selectRoadSegmentById = function(areaId) {
        if (!window.activeRoadSegments) return;
        for (var i = 0; i < window.activeRoadSegments.length; i++) {
          if (window.activeRoadSegments[i].id === areaId) {
            window.highlightRoadSegment(window.activeRoadSegments[i]);
            break;
          }
        }
      };

      // Highlight 1 Klaster Spesifik Sepanjang Ruas Jalan
      window.highlightCluster = function(pt) {
        window.clusterHighlightLayer.clearLayers();
        if (!pt || !pt.position) return;

        var lat = pt.position.latitude;
        var lng = pt.position.longitude;
        var sevColor = pt.severity === 'severe' ? '#991B1B' : (pt.severity === 'high' ? '#EF4444' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));

        var segCoords = [];
        if (pt.road_segment_coords && pt.road_segment_coords.length > 1) {
          segCoords = pt.road_segment_coords.map(function(c) { return [c.latitude, c.longitude]; });
        } else if (pt.points && pt.points.length > 1) {
          segCoords = pt.points.map(function(c) { return [c.latitude, c.longitude]; });
        } else {
          segCoords = [
            [lat - 0.0001, lng],
            [lat + 0.0001, lng]
          ];
        }

        var line = L.polyline(segCoords, {
          color: sevColor,
          weight: 7,
          opacity: 0.88,
          lineCap: 'round',
          lineJoin: 'round'
        });
        window.clusterHighlightLayer.addLayer(line);

        window.map.panTo([lat, lng], { animate: true, duration: 0.5 });
      };

      // 3. Render Titik Klaster di Level Dekat (zoom >= 17): Menggunakan Badge Icon Lokasi Map Pin
      window.renderDamageClusterMarkers = function(points) {
        window.damageLayer.clearLayers();
        points.forEach(function(pt) {
          var ptSevColor = pt.severity === 'severe' ? '#991B1B' : (pt.severity === 'high' ? '#EF4444' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));
          var pinSvg = createLocationPinSvg(ptSevColor, pt.reportCount);
          var pinHtml = '<div class="location-pin-marker">' + pinSvg + '</div>';
          var icon = L.divIcon({
            className: '',
            html: pinHtml,
            iconSize: [26, 34],
            iconAnchor: [13, 34]
          });
          var marker = L.marker([pt.position.latitude, pt.position.longitude], {
            icon: icon,
            zIndexOffset: 150
          });
          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
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

      // 4. Logika Master Level of Detail (LOD):
      // - Dekat: zoom >= 17
      // - Agak Jauh: 15 <= zoom < 17
      // - Jauh: zoom < 15
      window.updateLOD = function(zoom) {
        var z = zoom !== undefined ? zoom : window.map.getZoom();

        // 1. Tampilan Jauh (zoom < 15): Ruas Panjang Jalan & Badge Makro (Angka & Warna)
        if (z < 15) {
          if (!window.map.hasLayer(window.areaSummaryLayer)) {
            window.areaSummaryLayer.addTo(window.map);
          }
          window.renderAreaSummaryMarkers(window.activeRoadSegments);

          if (window.heatLayer && window.map.hasLayer(window.heatLayer)) {
            window.map.removeLayer(window.heatLayer);
          }
          window.damageLayer.clearLayers();
          window.clusterHighlightLayer.clearLayers();
        }
        // 2. Tampilan Agak Jauh (15 <= zoom < 17): Heatmap Seruas Jalan Saja
        else if (z >= 15 && z < 17) {
          window.areaSummaryLayer.clearLayers();
          window.damageLayer.clearLayers();
          window.clusterHighlightLayer.clearLayers();

          if (!window.heatLayer && window.rawHeatData && window.rawHeatData.length > 0) {
            window.heatLayer = window.createHeatmapLayer(window.rawHeatData);
          }
          if (window.heatLayer && !window.map.hasLayer(window.heatLayer)) {
            window.heatLayer.addTo(window.map);
          }
        }
        // 3. Tampilan Dekat (zoom >= 17): Titik-titik Lokasi Klaster dengan Badge Icon Lokasi
        else {
          window.areaSummaryLayer.clearLayers();

          if (window.heatLayer && window.map.hasLayer(window.heatLayer)) {
            window.map.removeLayer(window.heatLayer);
          }

          window.renderDamageClusterMarkers(window.rawDamagePoints);
        }
      };

      // Handler Zoom End
      window.map.on('zoomend', function() {
        window.updateLOD();
      });

      // Pembaruan Titik Klaster
      window.renderDamagePoints = function(points) {
        window.rawDamagePoints = points || [];
        window.activeRoadSegments = computeRoadSegmentAreas(window.rawDamagePoints);
        window.updateLOD();
      };

      // Pembaruan Heatmap
      window.updateHeatmap = function(heatData) {
        window.rawHeatData = heatData || [];
        if (window.heatLayer) {
          window.map.removeLayer(window.heatLayer);
          window.heatLayer = null;
        }
        window.updateLOD();
      };

      // Navigasi FlyTo
      window.flyToLocation = function(lat, lng, zoomLevel) {
        window.map.flyTo([lat, lng], zoomLevel || 17, { animate: true, duration: 0.8 });
      };

      // Inisialisasi awal LOD
      window.activeRoadSegments = computeRoadSegmentAreas(window.rawDamagePoints);
      window.updateLOD();

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
        var validCoords = (Array.isArray(coords) && coords.length > 0) ? coords : [];
        if (window.routePolyline) {
          window.routePolyline.setLatLngs(validCoords);
        } else if (validCoords.length > 0) {
          window.routePolyline = L.polyline(validCoords, {
            color: '#0040FF',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round'
          }).addTo(window.map);
        }

        if (validCoords.length > 1 && window.map) {
          try {
            window.map.fitBounds(validCoords, { padding: [60, 60], maxZoom: 16, animate: true });
          } catch(e) {}
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
      coords.map((c) => [c.latitude, c.longitude]),
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

  // 5. Pembaruan highlight cakupan area klaster saat user memilih klaster
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;

    if (data.activeClusterId === lastActiveClusterIdRef.current) return;
    lastActiveClusterIdRef.current = data.activeClusterId ?? null;

    if (data.activeClusterId) {
      const activePt = data.damagePoints.find(
        (p) => p.id === data.activeClusterId,
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

  // 5b. Pembaruan highlight ruas panjang jalan saat user memilih area ruas jalan
  const lastActiveAreaIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current) return;
    if (data.activeAreaId === lastActiveAreaIdRef.current) return;
    lastActiveAreaIdRef.current = data.activeAreaId ?? null;

    if (data.activeAreaId) {
      const js = `
        if (window.selectRoadSegmentById) window.selectRoadSegmentById("${data.activeAreaId}");
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    } else {
      const js = `
        if (window.clearRoadSegmentHighlight) window.clearRoadSegmentHighlight();
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [data.activeAreaId]);

  // 6. Pembaruan fokus / navigasi flyTo programatik (zoom >= 17 untuk level dekat)
  useEffect(() => {
    if (!isMapLoaded.current || !webViewRef.current || !focusCoords) return;
    const { latitude, longitude, zoom = 17 } = focusCoords;
    const js = `
      if (window.flyToLocation) window.flyToLocation(${latitude}, ${longitude}, ${zoom});
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [focusCoords]);

  const handleMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === "MAP_READY") {
        isMapLoaded.current = true;
        // Langsung sinkronkan posisi, rute, dan heatmap saat ini begitu map siap
        const lat = data.vehiclePosition.latitude;
        const lng = data.vehiclePosition.longitude;
        const routeJson = JSON.stringify(
          data.route.coordinates.map((c) => [c.latitude, c.longitude]),
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
      } else if (payload.type === "AREA_SUMMARY_PRESS" && onAreaSummaryPress) {
        onAreaSummaryPress(payload.area);
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
            <ActivityIndicator size="small" color="#0040FF" />
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
