import React, { useMemo, useRef, useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
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
  /** Callback saat titik kerusakan ditekan PERTAMA KALI (fokus & area panjang jalan, tanpa modal) */
  onPointSelected?: (point: DamagePoint, area?: AreaSummary) => void;
  /** Callback saat titik ringkasan ruas jalan ditekan */
  onAreaSummaryPress?: (area: AreaSummary) => void;
  /** Callback saat pengguna mengetuk area kosong peta (reset pilihan) */
  onClearSelection?: () => void;
};

const WebViewComponent = WebView as any;

export const LeafletMap = React.memo(function LeafletMap({
  data,
  vehicleType = "car",
  interactive = true,
  focusCoords,
  onDamagePress,
  onPointSelected,
  onAreaSummaryPress,
  onClearSelection,
}: LeafletMapProps) {
  const webViewRef = useRef<any>(null);
  const isMapLoaded = useRef<boolean>(false);
  const lastInjectedPos = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteLengthRef = useRef<number>(0);
  const lastDamageJsonRef = useRef<string>("");
  const lastActiveClusterIdRef = useRef<string | null>(null);

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
      filter: drop-shadow(0 3px 5px rgba(15, 23, 42, 0.35));
      cursor: pointer;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
      user-select: none;
    }
    .location-pin-marker:active {
      transform: scale(1.15) translateY(-2px);
    }
    .location-pin-marker.is-active {
      transform: scale(1.22) translateY(-3px);
      filter: drop-shadow(0 6px 12px rgba(15, 23, 42, 0.5));
      z-index: 9999 !important;
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
    /* 3. Sub-detection marker: Modern, minimal, pulsating pip */
    .sub-detection-marker {
      position: relative;
      width: 22px !important;
      height: 22px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
    }
    .sub-detection-pulse {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      opacity: 0.3;
      transform: scale(0.9);
      animation: subPointPulse 2.4s ease-out infinite;
    }
    @keyframes subPointPulse {
      0% { transform: scale(0.8); opacity: 0.45; }
      50% { transform: scale(1.3); opacity: 0.12; }
      100% { transform: scale(0.8); opacity: 0.45; }
    }
    .sub-detection-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 5px rgba(15, 23, 42, 0.4);
      z-index: 2;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .sub-detection-marker:active .sub-detection-dot,
    .sub-detection-marker:hover .sub-detection-dot {
      transform: scale(1.4);
    }
    .subpoint-tooltip {
      background: rgba(15, 23, 42, 0.94) !important;
      backdrop-filter: blur(8px) !important;
      -webkit-backdrop-filter: blur(8px) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 9999px !important;
      font-size: 11px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-weight: 700 !important;
      padding: 3px 9px !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35) !important;
      white-space: nowrap !important;
    }
    .subpoint-tooltip::before {
      border-top-color: rgba(15, 23, 42, 0.94) !important;
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
      window.activeMapRoute = (initialRoute && initialRoute.length > 0) ? initialRoute : [];
      window.clusterRoadCache = {};
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

      // 2. State & Layer Groups untuk Multi-Level LOD
      // LOD 1 (Jauh, zoom < 16): Ruas Panjang Jalan & Badge Makro (Angka & Warna)
      // LOD 2 (Dekat, zoom >= 16): Seluruh Titik Kerusakan dengan Badge Icon Lokasi
      window.areaSummaryLayer = L.layerGroup().addTo(window.map);
      window.activeRoadSegmentLayer = L.layerGroup().addTo(window.map);
      window.clusterHighlightLayer = L.layerGroup().addTo(window.map);
      window.damageLayer = L.layerGroup().addTo(window.map);

      window.rawDamagePoints = ${damageData} || [];
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

      function distanceToSegmentMeters(lat, lng, aLat, aLng, bLat, bLng) {
        var midLatRad = ((aLat + bLat) / 2) * (Math.PI / 180);
        var cosLat = Math.cos(midLatRad);
        var DEG_TO_M = 111320;
        var ax = aLng * DEG_TO_M * cosLat;
        var ay = aLat * DEG_TO_M;
        var bx = bLng * DEG_TO_M * cosLat;
        var by = bLat * DEG_TO_M;
        var px = lng * DEG_TO_M * cosLat;
        var py = lat * DEG_TO_M;

        var dx = bx - ax;
        var dy = by - ay;
        var lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) {
          var diffX = px - ax;
          var diffY = py - ay;
          return { dist: Math.sqrt(diffX * diffX + diffY * diffY), t: 0, proj: [aLat, aLng] };
        }

        var t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        var projX = ax + t * dx;
        var projY = ay + t * dy;
        var distX = px - projX;
        var distY = py - projY;
        var projLat = projY / DEG_TO_M;
        var projLng = projX / (DEG_TO_M * cosLat);
        return { dist: Math.sqrt(distX * distX + distY * distY), t: t, proj: [projLat, projLng] };
      }

      function findClosestPointOnPolyline(lat, lng, polyline) {
        if (!polyline || polyline.length < 2) return { dist: Infinity, segIdx: 0, proj: [lat, lng], t: 0 };
        var bestDist = Infinity;
        var bestIdx = 0;
        var bestProj = [lat, lng];
        var bestT = 0;

        for (var i = 0; i < polyline.length - 1; i++) {
          var a = polyline[i];
          var b = polyline[i + 1];
          var aLat = a.lat !== undefined ? a.lat : a[0];
          var aLng = a.lng !== undefined ? a.lng : a[1];
          var bLat = b.lat !== undefined ? b.lat : b[0];
          var bLng = b.lng !== undefined ? b.lng : b[1];

          var res = distanceToSegmentMeters(lat, lng, aLat, aLng, bLat, bLng);
          if (res.dist < bestDist) {
            bestDist = res.dist;
            bestIdx = i;
            bestProj = res.proj;
            bestT = res.t;
          }
        }
        return { dist: bestDist, segIdx: bestIdx, proj: bestProj, t: bestT };
      }

      function slicePolylineAroundPoint(polyline, segIdx, projPt, halfLenMeters) {
        var backwardCoords = [projPt];
        var accumulatedBack = 0;
        var currBack = projPt;
        for (var i = segIdx; i >= 0; i--) {
          var rawV = polyline[i];
          var v = [rawV.lat !== undefined ? rawV.lat : rawV[0], rawV.lng !== undefined ? rawV.lng : rawV[1]];
          var d = haversineM(currBack[0], currBack[1], v[0], v[1]);
          if (accumulatedBack + d >= halfLenMeters) {
            var remain = halfLenMeters - accumulatedBack;
            var frac = d > 0 ? (remain / d) : 1;
            var cutLat = currBack[0] + frac * (v[0] - currBack[0]);
            var cutLng = currBack[1] + frac * (v[1] - currBack[1]);
            backwardCoords.push([cutLat, cutLng]);
            break;
          } else {
            accumulatedBack += d;
            backwardCoords.push(v);
            currBack = v;
          }
        }

        backwardCoords.reverse();

        var forwardCoords = [];
        var accumulatedFwd = 0;
        var currFwd = projPt;
        for (var j = segIdx + 1; j < polyline.length; j++) {
          var rawW = polyline[j];
          var w = [rawW.lat !== undefined ? rawW.lat : rawW[0], rawW.lng !== undefined ? rawW.lng : rawW[1]];
          var df = haversineM(currFwd[0], currFwd[1], w[0], w[1]);
          if (accumulatedFwd + df >= halfLenMeters) {
            var remFwd = halfLenMeters - accumulatedFwd;
            var fracFwd = df > 0 ? (remFwd / df) : 1;
            var cutFwdLat = currFwd[0] + fracFwd * (w[0] - currFwd[0]);
            var cutFwdLng = currFwd[1] + fracFwd * (w[1] - currFwd[1]);
            forwardCoords.push([cutFwdLat, cutFwdLng]);
            break;
          } else {
            accumulatedFwd += df;
            forwardCoords.push(w);
            currFwd = w;
          }
        }

        return backwardCoords.concat(forwardCoords);
      }

      // Helper membuat SVG Badge Icon Lokasi (Map Pin)
      function createLocationPinSvg(sevColor, count, isActive) {
        var strokeCol = isActive ? '#FDE047' : '#ffffff';
        var strokeW = isActive ? '2.8' : '2';
        var innerContent = (count && count > 1)
          ? '<text x="12" y="15" text-anchor="middle" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-weight="900" fill="#ffffff">' + count + '</text>'
          : '<circle cx="12" cy="11.5" r="4.2" fill="#ffffff"/>';

        return '<svg width="' + (isActive ? 30 : 26) + '" height="' + (isActive ? 38 : 34) + '" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M12 0C5.372 0 0 5.372 0 12C0 19.8 12 32 12 32C12 32 24 19.8 24 12C24 5.372 18.628 0 12 0Z" fill="' + sevColor + '" stroke="' + strokeCol + '" stroke-width="' + strokeW + '"/>' +
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
          gradient: { 0.2: '#009EFF', 0.5: '#EAB308', 0.75: '#F59E0B', 1.0: '#EF4444' }
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
            window.activeSelectedPointId = null;
            window.highlightRoadSegment(area, null);
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
      window.highlightRoadSegment = function(area, selectedPointId) {
        window.activeRoadSegmentLayer.clearLayers();
        if (!area) return;

        var sevColor = area.worstSeverity === 'severe' ? '#991B1B' : (area.worstSeverity === 'high' ? '#EF4444' : (area.worstSeverity === 'medium' ? '#F59E0B' : '#EAB308'));

        // A. Gambar Garis Koridor Area Panjang Jalan (Road Segment Polyline)
        if (area.roadPolyline && area.roadPolyline.length > 1) {
          var polyCoords = area.roadPolyline.map(function(p) { return [p.lat || p.latitude, p.lng || p.longitude]; });

          // Garis Koridor Luar Halus
          var corridorHalo = L.polyline(polyCoords, {
            color: sevColor,
            weight: 8,
            opacity: 0.28,
            lineCap: 'round',
            lineJoin: 'round'
          });
          window.activeRoadSegmentLayer.addLayer(corridorHalo);

          // Garis Inti Jalan
          var corridorCore = L.polyline(polyCoords, {
            color: sevColor,
            weight: 3.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          });
          window.activeRoadSegmentLayer.addLayer(corridorCore);

          // Penyesuaian kamera rapi: jika tampilan jauh, sesuaikan batas. Jika sudah dekat, cukup pan mulus ke titik
          if (window.map.getZoom() < 16) {
            try {
              window.map.fitBounds(corridorHalo.getBounds(), { padding: [40, 40], maxZoom: 16.5, animate: true });
            } catch(e) {}
          } else if (selectedPointId && area.clusters) {
            var selPt = area.clusters.find(function(c) { return c.id === selectedPointId; });
            if (selPt) {
              window.map.panTo([selPt.position.latitude, selPt.position.longitude], { animate: true, duration: 0.35 });
            }
          }
        }

        // B. Jika zoom < 16 (tampilan makro), tampilkan pin titik di ruas jalan ini agar langsung terlihat dan bisa diklik
        if (window.map.getZoom() < 16 && area.clusters && area.clusters.length > 0) {
          area.clusters.forEach(function(pt) {
            var isPtActive = selectedPointId && (pt.id === selectedPointId);
            var ptSevColor = pt.severity === 'severe' ? '#991B1B' : (pt.severity === 'high' ? '#EF4444' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));
            var pinSvg = createLocationPinSvg(ptSevColor, pt.reportCount, isPtActive);
            var pinHtml = '<div class="location-pin-marker' + (isPtActive ? ' is-active' : '') + '">' + pinSvg + '</div>';
            var iconW = isPtActive ? 30 : 26;
            var iconH = isPtActive ? 38 : 34;
            var pinIcon = L.divIcon({
              className: '',
              html: pinHtml,
              iconSize: [iconW, iconH],
              iconAnchor: [iconW / 2, iconH]
            });
            var pinMarker = L.marker([pt.position.latitude, pt.position.longitude], {
              icon: pinIcon,
              zIndexOffset: isPtActive ? 600 : 300
            });

            pinMarker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              window.handlePointInteraction(pt, area);
            });
            window.activeRoadSegmentLayer.addLayer(pinMarker);
          });
        }
      };

      // 2b. Render Rute Jalan Klaster dan Titik-Titik Deteksi Sub-Klaster (Modern & Simple)
      window.renderClusterRouteAndSubPoints = function(pt, routeCoords, isUpdate, skipCamera) {
        if (!pt || !routeCoords || routeCoords.length < 2) return;
        window.clusterHighlightLayer.clearLayers();

        var sevColor = pt.severity === 'severe' ? '#EF4444' : (pt.severity === 'high' ? '#F97316' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));

        // A. Dual-layer Road Corridor (Visual modern & simple mengikuti geometri rute jalan):
        // 1. Underlay Halo Corridor
        var routeHalo = L.polyline(routeCoords, {
          color: sevColor,
          weight: 10,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        });
        window.clusterHighlightLayer.addLayer(routeHalo);

        // 2. Centerline Inti Jalan
        var routeCore = L.polyline(routeCoords, {
          color: sevColor,
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        });
        window.clusterHighlightLayer.addLayer(routeCore);

        // 3. Terminal Endpoint Pips (Penanda batas awal & akhir zona bahaya yang rapi & minimalis)
        var startCap = L.circleMarker(routeCoords[0], {
          radius: 3.5,
          color: sevColor,
          weight: 2,
          fillColor: '#ffffff',
          fillOpacity: 1.0,
          interactive: false
        });
        window.clusterHighlightLayer.addLayer(startCap);

        var endCap = L.circleMarker(routeCoords[routeCoords.length - 1], {
          radius: 3.5,
          color: sevColor,
          weight: 2,
          fillColor: '#ffffff',
          fillOpacity: 1.0,
          interactive: false
        });
        window.clusterHighlightLayer.addLayer(endCap);

        // B. Render Titik-Titik Highlight Sub-Klaster (Tersnap rapi sepanjang garis jalan)
        var subPoints = (Array.isArray(pt.points) && pt.points.length > 0)
          ? pt.points
          : [{ latitude: pt.position.latitude, longitude: pt.position.longitude, intensity: 1.0 }];

        var renderedSubCoords = [];

        subPoints.forEach(function(sp, idx) {
          var rawLat = sp.latitude !== undefined ? sp.latitude : sp.lat;
          var rawLng = sp.longitude !== undefined ? sp.longitude : sp.lng;
          var spIntensity = sp.intensity !== undefined ? sp.intensity : (pt.severity === 'severe' ? 3.5 : (pt.severity === 'high' ? 2.5 : (pt.severity === 'medium' ? 1.5 : 0.8)));

          // Snap sub-point ke sumbu rute jalan jika berada dalam radius 15 meter
          var snapRes = findClosestPointOnPolyline(rawLat, rawLng, routeCoords);
          var finalLat = (snapRes.dist <= 15) ? snapRes.proj[0] : rawLat;
          var finalLng = (snapRes.dist <= 15) ? snapRes.proj[1] : rawLng;
          renderedSubCoords.push([finalLat, finalLng]);

          // Marker modern minimalis: white ring + colored dot + ambient pulse
          var subHtml = '<div class="sub-detection-marker">' +
            '<div class="sub-detection-pulse" style="background-color: ' + sevColor + ';"></div>' +
            '<div class="sub-detection-dot" style="background-color: ' + sevColor + ';"></div>' +
            '</div>';

          var subIcon = L.divIcon({
            className: '',
            html: subHtml,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          var subMarker = L.marker([finalLat, finalLng], {
            icon: subIcon,
            zIndexOffset: 850 + idx
          });

          var tooltipText = '<span style="color:' + sevColor + ';font-weight:800;">#' + (idx + 1) + '</span> ' +
            '<span style="opacity:0.4;margin:0 3px;">•</span> ' +
            'Guncangan <span style="font-family:monospace;font-weight:700;">' + (Math.round(spIntensity * 10) / 10) + 'g</span>';

          subMarker.bindTooltip(tooltipText, {
            direction: 'top',
            offset: [0, -8],
            className: 'subpoint-tooltip'
          });

          window.clusterHighlightLayer.addLayer(subMarker);
        });

        // C. Update status visual pin pada layer damage
        if (window.map && window.map.getZoom() < 16) {
          var pinSvg = createLocationPinSvg(sevColor, pt.reportCount, true);
          var pinHtml = '<div class="location-pin-marker is-active">' + pinSvg + '</div>';
          var pinIcon = L.divIcon({
            className: '',
            html: pinHtml,
            iconSize: [30, 38],
            iconAnchor: [15, 38]
          });
          var pinMarker = L.marker([pt.position.latitude, pt.position.longitude], {
            icon: pinIcon,
            zIndexOffset: 5000
          });
          pinMarker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            window.handlePointInteraction(pt, null);
          });
          window.clusterHighlightLayer.addLayer(pinMarker);
        } else if (window.rawDamagePoints) {
          window.renderDamageClusterMarkers(window.rawDamagePoints);
        }

        // D. Penyesuaian kamera membungkus rute per klaster dan seluruh sub-titiknya
        if (!skipCamera && !isUpdate && window.map) {
          var allCoords = routeCoords.concat(renderedSubCoords);
          if (allCoords.length > 1) {
            try {
              var bounds = L.latLngBounds(allCoords);
              window.map.fitBounds(bounds, { padding: [65, 65], maxZoom: 17.5, animate: true });
            } catch (err) {
              window.map.setView([pt.position.latitude, pt.position.longitude], 17.5, { animate: true });
            }
          } else {
            window.map.setView([pt.position.latitude, pt.position.longitude], 17.5, { animate: true });
          }
        }
      };

      // 2c. Highlight Rute Per Klaster: Mengikuti Rute Maps (Active Route / OSRM Snapping / Local)
      window.highlightClusterDetails = function(pt, options) {
        if (!pt || !pt.position) return;
        var opts = options || {};
        var skipCamera = opts.skipCamera || false;

        window.activeSelectedPointId = pt.id;

        var halfLen = Math.max(15, ((pt.road_length_meters || 30) / 2));

        // 1. Cek apakah titik klaster ini berada di dekat Rute Navigasi Aktif di peta
        var activeRoute = window.activeMapRoute || [];
        var slicedFromRoute = null;

        if (activeRoute && activeRoute.length > 1) {
          var routeCheck = findClosestPointOnPolyline(pt.position.latitude, pt.position.longitude, activeRoute);
          if (routeCheck.dist <= 45) {
            // Berada di sepanjang rute navigasi map! Ambil potongan rute map yang presisi
            slicedFromRoute = slicePolylineAroundPoint(activeRoute, routeCheck.segIdx, routeCheck.proj, halfLen);
          }
        }

        if (slicedFromRoute && slicedFromRoute.length > 1) {
          window.renderClusterRouteAndSubPoints(pt, slicedFromRoute, false, skipCamera);
          return;
        }

        // 2. Cek apakah rute OpenStreetMap sudah ada di cache
        if (window.clusterRoadCache && window.clusterRoadCache[pt.id]) {
          window.renderClusterRouteAndSubPoints(pt, window.clusterRoadCache[pt.id], false, skipCamera);
          return;
        }

        // 3. Fallback lokal awal: Ekstrak lintasan awal terproyeksi
        var localCoords = [];
        if (Array.isArray(pt.road_segment_coords) && pt.road_segment_coords.length > 1) {
          localCoords = pt.road_segment_coords.map(function(c) {
            return [c.latitude !== undefined ? c.latitude : c.lat, c.longitude !== undefined ? c.longitude : c.lng];
          });
        } else if (Array.isArray(pt.points) && pt.points.length > 1) {
          localCoords = pt.points.map(function(p) {
            return [p.latitude !== undefined ? p.latitude : p.lat, p.longitude !== undefined ? p.longitude : p.lng];
          });
        }

        if (localCoords.length < 2) {
          var cLat = pt.position.latitude;
          var cLng = pt.position.longitude;
          var deltaLat = 0.00012;
          var deltaLng = 0.00008;
          localCoords = [
            [cLat - deltaLat, cLng - deltaLng],
            [cLat + deltaLat, cLng + deltaLng]
          ];
        }

        // Render langsung koordinat lokal agar tidak ada jeda (0 ms)
        window.renderClusterRouteAndSubPoints(pt, localCoords, false, skipCamera);

        // 4. Asynchronously fetch rute geometris jalan raya nyata dari OSRM (OpenStreetMap Roads)
        var pStart = localCoords[0];
        var pEnd = localCoords[localCoords.length - 1];
        var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
          pStart[1] + ',' + pStart[0] + ';' + pEnd[1] + ',' + pEnd[0] +
          '?overview=full&geometries=geojson&steps=false';

        fetch(osrmUrl)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data && data.code === 'Ok' && data.routes && data.routes[0] && data.routes[0].geometry) {
              var geomCoords = data.routes[0].geometry.coordinates;
              if (geomCoords && geomCoords.length > 1) {
                var snappedRoad = geomCoords.map(function(c) { return [c[1], c[0]]; });
                window.clusterRoadCache[pt.id] = snappedRoad;
                // Jika user masih melihat klaster ini, perbarui dengan rute jalan OpenStreetMap yang mulus
                if (window.activeSelectedPointId === pt.id) {
                  window.renderClusterRouteAndSubPoints(pt, snappedRoad, true, true);
                }
              }
            }
          })
          .catch(function() {
            // Jika offline atau OSRM gagal, localCoords yang sudah ter-render tetap aktif
          });
      };

      // Penangan sentral interaksi klik titik (TWO-STEP INTERACTION):
      // - Klik 1: Tampilkan rute per klaster dan titik-titik highlight sub-klasternya (TANPA BUKA MODAL)
      // - Klik 2 (Klik LAGI pada icon titiknya): BARU BUKA MODAL Road Damage Details!
      window.handlePointInteraction = function(pt, areaContext) {
        if (!pt) return;

        // Cek apakah titik ini SUDAH merupakan titik yang aktif
        if (window.activeSelectedPointId === pt.id) {
          // KLIK KEDUA: Buka modal Road Damage Details!
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DAMAGE_PRESS',
              point: pt
            }));
          }
          return;
        }

        // KLIK PERTAMA: Simpan titik aktif, render rute per klaster & seluruh titik highlight sub-klaster
        window.activeSelectedPointId = pt.id;

        // Cari ruas jalan yang menaungi titik ini untuk konteks area (jika ada)
        var targetArea = areaContext;
        if (!targetArea && window.activeRoadSegments) {
          for (var i = 0; i < window.activeRoadSegments.length; i++) {
            var seg = window.activeRoadSegments[i];
            if (seg.clusters && seg.clusters.some(function(c) { return c.id === pt.id; })) {
              targetArea = seg;
              break;
            }
          }
        }

        // Tampilkan rute per klaster dan titik-titik highlight sub-klasternya
        window.highlightClusterDetails(pt, { skipCamera: false });

        // Beritahu React Native bahwa titik telah terpilih (Klik 1 - TANPA BUKA MODAL)
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'POINT_SELECTED',
            point: pt,
            area: targetArea
          }));
        }
      };

      window.clearClusterHighlight = function() {
        window.activeSelectedPointId = null;
        window.clusterHighlightLayer.clearLayers();
        if (window.map && window.map.getZoom() >= 16) {
          window.renderDamageClusterMarkers(window.rawDamagePoints);
        }
      };

      window.clearRoadSegmentHighlight = function() {
        window.activeSelectedPointId = null;
        window.activeRoadSegmentLayer.clearLayers();
        window.clusterHighlightLayer.clearLayers();
        if (window.map && window.map.getZoom() >= 16) {
          window.renderDamageClusterMarkers(window.rawDamagePoints);
        }
      };

      window.selectRoadSegmentById = function(areaId) {
        if (!window.activeRoadSegments) return;
        for (var i = 0; i < window.activeRoadSegments.length; i++) {
          if (window.activeRoadSegments[i].id === areaId) {
            window.highlightRoadSegment(window.activeRoadSegments[i], null);
            break;
          }
        }
      };

      // Highlight 1 Klaster Spesifik Sepanjang Ruas Jalan
      window.highlightCluster = function(pt) {
        if (!pt || !pt.position) {
          window.clearClusterHighlight();
          return;
        }

        var isAlreadySelected = (window.activeSelectedPointId === pt.id);
        window.highlightClusterDetails(pt, { skipCamera: isAlreadySelected });
      };

      // 3. Render Titik Klaster di Level Dekat (zoom >= 16): Menggunakan Badge Icon Lokasi Map Pin
      window.renderDamageClusterMarkers = function(points) {
        window.damageLayer.clearLayers();
        points.forEach(function(pt) {
          var isPtActive = window.activeSelectedPointId && (pt.id === window.activeSelectedPointId);
          var ptSevColor = pt.severity === 'severe' ? '#991B1B' : (pt.severity === 'high' ? '#EF4444' : (pt.severity === 'medium' ? '#F59E0B' : '#EAB308'));
          var pinSvg = createLocationPinSvg(ptSevColor, pt.reportCount, isPtActive);
          var pinHtml = '<div class="location-pin-marker' + (isPtActive ? ' is-active' : '') + '">' + pinSvg + '</div>';
          var iconW = isPtActive ? 30 : 26;
          var iconH = isPtActive ? 38 : 34;
          var icon = L.divIcon({
            className: '',
            html: pinHtml,
            iconSize: [iconW, iconH],
            iconAnchor: [iconW / 2, iconH]
          });
          var marker = L.marker([pt.position.latitude, pt.position.longitude], {
            icon: icon,
            zIndexOffset: isPtActive ? 5000 : 150
          });
          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            window.handlePointInteraction(pt, null);
          });
          window.damageLayer.addLayer(marker);
        });
      };

      // 4. Logika Master Level of Detail (LOD):
      // - Jauh (zoom < 16): Ruas Panjang Jalan & Badge Makro (Angka & Warna)
      // - Dekat (zoom >= 16): Titik-titik Lokasi Klaster Kerusakan
      window.updateLOD = function(zoom) {
        var z = zoom !== undefined ? zoom : window.map.getZoom();

        if (z < 16) {
          if (!window.map.hasLayer(window.areaSummaryLayer)) {
            window.areaSummaryLayer.addTo(window.map);
          }
          window.renderAreaSummaryMarkers(window.activeRoadSegments);
          window.damageLayer.clearLayers();
          // Pertahankan highlight rute & sub-titik jika ada klaster yang sedang aktif
          if (!window.activeSelectedPointId) {
            window.clusterHighlightLayer.clearLayers();
          }
        } else {
          window.areaSummaryLayer.clearLayers();
          // Pertahankan highlight rute & sub-titik jika ada klaster yang sedang aktif
          if (!window.activeSelectedPointId) {
            window.clusterHighlightLayer.clearLayers();
          }
          window.renderDamageClusterMarkers(window.rawDamagePoints);
        }
      };

      // Handler Zoom End
      window.map.on('zoomend', function() {
        window.updateLOD();
      });

      // Handler Background Map Click: Reset seleksi jika pengguna klik area kosong di peta
      window.map.on('click', function() {
        window.clearClusterHighlight();
        window.clearRoadSegmentHighlight();
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'CLEAR_SELECTION'
          }));
        }
      });

      // Pembaruan Titik Klaster
      window.renderDamagePoints = function(points) {
        window.rawDamagePoints = points || [];
        window.activeRoadSegments = computeRoadSegmentAreas(window.rawDamagePoints);
        window.updateLOD();
        if (window.activeSelectedPointId) {
          var stillActive = window.rawDamagePoints.find(function(p) { return p.id === window.activeSelectedPointId; });
          if (stillActive) {
            window.highlightClusterDetails(stillActive, { skipCamera: true });
          } else {
            window.activeSelectedPointId = null;
            window.clusterHighlightLayer.clearLayers();
          }
        }
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
        window.activeMapRoute = validCoords;
        if (window.routePolyline) {
          window.routePolyline.setLatLngs(validCoords);
        } else if (validCoords.length > 0) {
          window.routePolyline = L.polyline(validCoords, {
            color: '#009EFF',
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
        // Langsung sinkronkan posisi dan rute saat ini begitu map siap
        const lat = data.vehiclePosition.latitude;
        const lng = data.vehiclePosition.longitude;
        const routeJson = JSON.stringify(
          data.route.coordinates.map((c) => [c.latitude, c.longitude])
        );
        const activePt = data.activeClusterId
          ? data.damagePoints.find((p) => p.id === data.activeClusterId)
          : null;
        const activeJson = JSON.stringify(activePt || null);

        webViewRef.current?.injectJavaScript(`
          if (window.updatePosition) window.updatePosition(${lat}, ${lng});
          if (window.updateRoute) window.updateRoute(${routeJson});
          if (${activeJson}) window.highlightCluster(${activeJson});
          true;
        `);
      } else if (payload.type === "POINT_SELECTED" && onPointSelected) {
        onPointSelected(payload.point, payload.area);
      } else if (payload.type === "CLEAR_SELECTION" && onClearSelection) {
        onClearSelection();
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
