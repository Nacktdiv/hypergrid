import {
  AlertTriangle,
  ChevronRight,
  Database,
  Layers,
  MapPin,
  ShieldAlert,
  X,
  ZoomIn,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { LeafletMap } from "@/components/map/leaflet-map";
import {
  type AreaSummary,
  type DamagePoint,
  type LatLng,
  type MapData,
} from "@/components/map/map-data";
import { MapCanvasSkeleton } from "@/components/ui/skeleton";
import { Touchable } from "@/components/ui/touchable";
import { useOptionalTheme } from "@/contexts/theme-context";
import { type VehicleId } from "@/contexts/vehicle-context";
import { usePotholeClusters } from "@/hooks/use-pothole-clusters";
import { useUserLocation } from "@/hooks/use-user-location";
import type { PotholeCluster, PotholeStatus } from "@/types/api";
import { ClusterRadialCard } from "./cluster-radial-card";

type FilterStatus = "all" | PotholeStatus;

export type MainMapFocusTarget = {
  latitude: number;
  longitude: number;
  zoom?: number;
  ts?: number;
};

export type MainMapProps = {
  vehicleId: VehicleId;
  fullBleed?: boolean;
  showOverlayControls?: boolean;
  bottomOffset?: number;
  onOpenClusterDetail?: (cluster: PotholeCluster) => void;
  currentCoords?: LatLng | null;
  plannedRoute?: LatLng[];
  focusTarget?: MainMapFocusTarget | null;
};

export const MainMap = React.memo(function MainMap({
  vehicleId,
  fullBleed = false,
  showOverlayControls = true,
  bottomOffset,
  onOpenClusterDetail,
  currentCoords: externalCoords,
  plannedRoute,
  focusTarget,
}: MainMapProps) {
  const { colors } = useOptionalTheme();
  const {
    clusters,
    isLoading: isClustersLoading,
    fetchClusters,
  } = usePotholeClusters();
  const hasExternalCoords = externalCoords !== undefined;
  const {
    coords: internalCoords,
    getImmediateLocation,
    errorMsg,
  } = useUserLocation(false, { enabled: !hasExternalCoords });

  const liveCoords = hasExternalCoords ? externalCoords : internalCoords;

  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [selectedCluster, setSelectedCluster] = useState<PotholeCluster | null>(
    null,
  );
  const [isClusterModalVisible, setIsClusterModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<AreaSummary | null>(null);
  const [isAreaModalVisible, setIsAreaModalVisible] = useState(false);
  const [manualFocus, setManualFocus] = useState<{
    baseTarget: MainMapFocusTarget | null | undefined;
    coords: MainMapFocusTarget;
  } | null>(null);

  const activeFocusCoords =
    manualFocus && (!focusTarget || manualFocus.baseTarget === focusTarget)
      ? manualFocus.coords
      : focusTarget ?? null;

  const [hasFetchedInitial, setHasFetchedInitial] = useState(
    () => clusters.length > 0 || !isClustersLoading,
  );

  const loadInitialClusters = useCallback(async () => {
    try {
      await fetchClusters({
        limit: 500,
        eps: 100,
        minPts: 2,
        vehicleType: vehicleId,
      });
    } finally {
      setHasFetchedInitial(true);
    }
  }, [fetchClusters, vehicleId]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadInitialClusters();
    });
    return () => task.cancel();
  }, [loadInitialClusters]);

  const filteredClusters = useMemo(() => {
    if (activeFilter === "all") return clusters;
    return clusters.filter((c) => c.status === activeFilter);
  }, [clusters, activeFilter]);

  const mapData: MapData = useMemo(() => {
    const baseCenter = liveCoords || { latitude: -6.2088, longitude: 106.8456 };

    const liveDamagePoints: DamagePoint[] = filteredClusters.map((c) => ({
      id: c.id,
      position: {
        latitude: c.center_latitude ?? (c as any).centerLatitude,
        longitude: c.center_longitude ?? (c as any).centerLongitude,
      },
      severity: c.severity,
      reportCount: c.detection_count ?? (c as any).detectionCount ?? 1,
      radius_meters: c.radius_meters || (c as any).radiusMeters || 18,
      road_length_meters:
        c.road_length_meters || (c as any).roadLengthMeters || 15,
      road_segment_coords: (
        c.road_segment_coords || (c as any).roadSegmentCoords
      )?.map((p: any) => ({
        latitude: p.latitude ?? p.lat,
        longitude: p.longitude ?? p.lng,
      })),
      userCount: c.user_count || (c as any).userCount || 1,
      points: c.points?.map((p: any) => ({
        latitude: p.latitude ?? p.lat,
        longitude: p.longitude ?? p.lng,
        intensity: p.intensity,
      })),
    }));

    return {
      camera: {
        latitude: baseCenter.latitude,
        longitude: baseCenter.longitude,
        zoom: 15,
      },
      route: { id: "user-route", coordinates: plannedRoute || [] },
      damagePoints: liveDamagePoints,
      activeClusterId: selectedCluster?.id ?? null,
      activeAreaId: selectedArea?.id ?? null,
      userLocation: baseCenter,
      vehiclePosition: baseCenter,
    };
  }, [
    filteredClusters,
    liveCoords,
    selectedCluster?.id,
    selectedArea?.id,
    plannedRoute,
  ]);

  const handleMarkerPress = useCallback(
    (point: DamagePoint) => {
      const found = clusters.find((c) => c.id === point.id);
      if (found) {
        setSelectedCluster(found);
        setIsClusterModalVisible(true);
        onOpenClusterDetail?.(found);
      }
    },
    [clusters, onOpenClusterDetail],
  );

  const handlePointSelected = useCallback(
    (point: DamagePoint, area?: AreaSummary) => {
      const found = clusters.find((c) => c.id === point.id);
      if (found) {
        setSelectedCluster(found);
      }
      if (area) {
        setSelectedArea(area);
      }
    },
    [clusters],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedCluster(null);
    setSelectedArea(null);
    setIsAreaModalVisible(false);
    setIsClusterModalVisible(false);
  }, []);

  if (!liveCoords || (!hasFetchedInitial && isClustersLoading)) {
    return (
      <View
        className={
          fullBleed
            ? "flex-1 w-full h-full items-center justify-center"
            : "flex-1 w-full items-center justify-center overflow-hidden rounded-2xl border"
        }
        style={[
          fullBleed
            ? { width: "100%", height: "100%" }
            : { height: 340, width: "100%" },
          { backgroundColor: colors.canvas, borderColor: colors.border },
        ]}
      >
        {errorMsg ? (
          <View className="items-center gap-2 p-4">
            <ShieldAlert size={28} color={colors.warning} />
            <Text
              className="text-center font-inter-bold text-xs"
              style={{ color: colors.text }}
            >
              {errorMsg}
            </Text>
            <Touchable
              onPress={() => getImmediateLocation()}
              className="mt-2 rounded-xl px-4 py-2"
              style={{ backgroundColor: colors.brand }}
            >
              <Text className="font-inter-bold text-xs text-white">Retry</Text>
            </Touchable>
          </View>
        ) : (
          <MapCanvasSkeleton />
        )}
      </View>
    );
  }

  const activeSeverity =
    selectedCluster?.severity || selectedArea?.worstSeverity || "medium";
  const severityTone =
    activeSeverity === "severe" || activeSeverity === "high"
      ? { bg: colors.dangerSoft, border: colors.danger, icon: colors.danger }
      : activeSeverity === "medium"
        ? {
            bg: colors.warningSoft,
            border: colors.warning,
            icon: colors.warning,
          }
        : {
            bg: colors.successSoft,
            border: colors.success,
            icon: colors.success,
          };

  return (
    <View
      className={
        fullBleed
          ? "flex-1 w-full h-full overflow-hidden"
          : "flex-1 w-full overflow-hidden rounded-2xl border"
      }
      style={[
        fullBleed
          ? { width: "100%", height: "100%" }
          : { height: 340, width: "100%" },
        { borderColor: colors.border },
      ]}
    >
      <LeafletMap
        data={mapData}
        vehicleType={vehicleId}
        focusCoords={activeFocusCoords}
        onDamagePress={handleMarkerPress}
        onPointSelected={handlePointSelected}
        onClearSelection={handleClearSelection}
        onAreaSummaryPress={setSelectedArea}
      />

      {showOverlayControls ? (
        <>
          <View
            className="absolute bottom-3 left-3 flex-row items-center gap-1.5 rounded-md border px-2.5 py-1 shadow-md"
            style={{
              backgroundColor: colors.pill,
              borderColor: colors.border,
            }}
          >
            <View
              className={`h-2 w-2 rounded-full ${liveCoords ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            <Text
              className="font-mono text-[9px] font-bold uppercase tracking-wider"
              style={{ color: colors.text }}
            >
              GPS{" "}
              {liveCoords
                ? `${liveCoords.latitude.toFixed(4)}, ${liveCoords.longitude.toFixed(4)}`
                : "SEARCHING..."}
            </Text>
          </View>

          <Touchable
            className="absolute bottom-3 right-3"
            onPress={() => getImmediateLocation()}
          >
            <View
              className="flex-row items-center gap-1 rounded-md border px-2 py-1 shadow-md"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <MapPin size={11} color={colors.brand} />
              <Text
                className="font-mono-bold text-[9px] uppercase tracking-wider"
                style={{ color: colors.text }}
              >
                My Location
              </Text>
            </View>
          </Touchable>
        </>
      ) : null}

      {showOverlayControls ? (
        <View className="absolute inset-x-3 top-3 gap-2">
          <View className="flex-row items-center justify-between">
            <View
              className="self-start flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm"
              style={{
                backgroundColor: colors.pill,
                borderColor: colors.border,
              }}
            >
              <Database size={12} color={colors.brand} />
              <Text
                className="font-mono text-[10px]"
                style={{ color: colors.textSecondary }}
              >
                {clusters.length > 0
                  ? `DBSCAN: ${filteredClusters.length} Road Hazard Clusters`
                  : "No Clusters Nearby"}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-1.5">
            <FilterChip
              active={activeFilter === "all"}
              label="All"
              onPress={() => setActiveFilter("all")}
            />
            <FilterChip
              active={activeFilter === "active"}
              label="Active"
              onPress={() => setActiveFilter("active")}
            />
            <FilterChip
              active={activeFilter === "verified"}
              label="Verified"
              onPress={() => setActiveFilter("verified")}
            />
            <FilterChip
              active={activeFilter === "repaired"}
              label="Repaired"
              onPress={() => setActiveFilter("repaired")}
            />
          </View>
        </View>
      ) : null}

      {/* ROAD DAMAGE CLUSTER DETAIL MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={isClusterModalVisible && Boolean(selectedCluster)}
        onRequestClose={() => setIsClusterModalVisible(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-t-[32px] p-6 border-t shadow-lg"
            style={{
              backgroundColor: colors.sheet,
              borderTopColor: colors.border,
            }}
          >
            {selectedCluster ? (
              <View className="gap-3.5">
                <View className="flex-row items-center justify-between pb-1">
                  <View className="flex-row items-center gap-2">
                    <ShieldAlert size={22} color={colors.danger} />
                    <Text
                      className="font-inter-bold text-lg"
                      style={{ color: colors.text }}
                    >
                      Road Damage Details
                    </Text>
                  </View>
                  <Touchable
                    onPress={() => setIsClusterModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close road damage details"
                  >
                    <View
                      className="rounded-full p-1.5"
                      style={{ backgroundColor: colors.subtle }}
                    >
                      <X size={18} color={colors.textMuted} />
                    </View>
                  </Touchable>
                </View>

                <ClusterRadialCard cluster={selectedCluster} />

                <View
                  className="rounded-xl border p-3 mt-0.5"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <ShieldAlert size={14} color={colors.textMuted} />
                    <Text
                      className="font-inter-bold text-[11px]"
                      style={{ color: colors.text }}
                    >
                      Public Road Hazard Data
                    </Text>
                  </View>
                  <Text
                    className="mt-1 font-inter text-[11px] leading-relaxed"
                    style={{ color: colors.textMuted }}
                  >
                    Verification, work orders, and road repairs are managed by
                    the Public Works Department via the Web Admin Dashboard.
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* COMPACT ROAD HAZARD CALLOUT */}
      {selectedArea || selectedCluster ? (
        <View
          style={{ bottom: bottomOffset ?? (fullBleed ? 124 : 16) }}
          className="absolute inset-x-4 z-30"
        >
          <View
            className="flex-row items-center justify-between rounded-2xl border px-3 py-2.5 shadow-lg"
            style={{
              backgroundColor: colors.pill,
              borderColor: colors.border,
            }}
          >
            <Pressable
              onPress={() => {
                if (selectedCluster) {
                  setIsClusterModalVisible(true);
                  onOpenClusterDetail?.(selectedCluster);
                } else if (selectedArea) {
                  setIsAreaModalVisible(true);
                }
              }}
              className="flex-1 flex-row items-center gap-2.5 mr-2 active:opacity-75"
            >
              <View
                className="h-8 w-8 rounded-xl items-center justify-center border"
                style={{
                  backgroundColor: severityTone.bg,
                  borderColor: severityTone.border,
                }}
              >
                <AlertTriangle size={15} color={severityTone.icon} />
              </View>

              <View className="flex-1">
                <Text
                  numberOfLines={1}
                  className="font-inter-bold text-xs"
                  style={{ color: colors.text }}
                >
                  {selectedArea && selectedArea.clusterCount > 1
                    ? `Road Segment: ${
                        selectedArea.roadLengthMeters >= 1000
                          ? `${(selectedArea.roadLengthMeters / 1000).toFixed(1)} km`
                          : `${selectedArea.roadLengthMeters} m`
                      }`
                    : selectedCluster
                      ? `Hazard Cluster (${selectedCluster.road_length_meters ? `${selectedCluster.road_length_meters}m` : "Cluster Area"})`
                      : "Road Hazard Spot"}
                </Text>
                <Text
                  numberOfLines={1}
                  className="font-inter text-[11px]"
                  style={{ color: colors.textMuted }}
                >
                  {selectedCluster
                    ? `${selectedCluster.detection_count} Detections · ${selectedCluster.severity.toUpperCase()}`
                    : selectedArea
                      ? `${selectedArea.clusterCount} Clusters · ${selectedArea.totalReports} Reports`
                      : "Tap to view details"}
                </Text>
              </View>
            </Pressable>

            <View className="flex-row items-center gap-1.5 shrink-0">
              <Pressable
                onPress={() => {
                  if (selectedCluster) {
                    setIsClusterModalVisible(true);
                    onOpenClusterDetail?.(selectedCluster);
                  } else if (selectedArea) {
                    setIsAreaModalVisible(true);
                  }
                }}
                className="flex-row items-center gap-1 rounded-xl px-3 py-1.5 active:opacity-90"
                style={{ backgroundColor: colors.brand }}
                accessibilityRole="button"
                accessibilityLabel="View road hazard details"
              >
                <Text className="font-inter-bold text-[11px] text-white">
                  Detail
                </Text>
                <ChevronRight size={13} color="#ffffff" />
              </Pressable>

              <Pressable
                onPress={handleClearSelection}
                className="h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.subtle }}
                accessibilityRole="button"
                accessibilityLabel="Close hazard banner"
              >
                <X size={13} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* ROAD SEGMENT DETAILED MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={isAreaModalVisible && Boolean(selectedArea)}
        onRequestClose={() => setIsAreaModalVisible(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-t-[32px] p-6 border-t shadow-lg max-h-[85%]"
            style={{
              backgroundColor: colors.sheet,
              borderTopColor: colors.border,
            }}
          >
            {selectedArea ? (
              <View className="gap-4">
                <View className="flex-row items-center justify-between pb-1">
                  <View className="flex-row items-center gap-2.5">
                    <View
                      className="rounded-xl p-2"
                      style={{ backgroundColor: colors.brandSoft }}
                    >
                      <Layers size={20} color={colors.brand} />
                    </View>
                    <View>
                      <Text
                        className="font-inter-bold text-lg"
                        style={{ color: colors.text }}
                      >
                        Road Segment:{" "}
                        {selectedArea.roadLengthMeters >= 1000
                          ? `${(selectedArea.roadLengthMeters / 1000).toFixed(1)} km`
                          : `${selectedArea.roadLengthMeters} m`}
                      </Text>
                      <Text
                        className="font-inter text-xs"
                        style={{ color: colors.textMuted }}
                      >
                        {selectedArea.clusterCount} hazard clusters along this
                        corridor
                      </Text>
                    </View>
                  </View>
                  <Touchable
                    onPress={() => setIsAreaModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close road segment details"
                  >
                    <View
                      className="rounded-full p-1.5"
                      style={{ backgroundColor: colors.subtle }}
                    >
                      <X size={18} color={colors.textMuted} />
                    </View>
                  </Touchable>
                </View>

                <View className="flex-row gap-2.5">
                  <View
                    className="flex-1 rounded-2xl p-3 border"
                    style={{
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="font-inter text-[11px]"
                      style={{ color: colors.textMuted }}
                    >
                      Clusters
                    </Text>
                    <Text
                      className="font-inter-bold text-xl mt-0.5"
                      style={{ color: colors.text }}
                    >
                      {selectedArea.clusterCount}
                    </Text>
                  </View>
                  <View
                    className="flex-1 rounded-2xl p-3 border"
                    style={{
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="font-inter text-[11px]"
                      style={{ color: colors.textMuted }}
                    >
                      Reports
                    </Text>
                    <Text
                      className="font-inter-bold text-xl mt-0.5"
                      style={{ color: colors.text }}
                    >
                      {selectedArea.totalReports}
                    </Text>
                  </View>
                  <View
                    className="flex-1 rounded-2xl p-3 border"
                    style={{
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="font-inter text-[11px]"
                      style={{ color: colors.textMuted }}
                    >
                      Peak Severity
                    </Text>
                    <Text
                      className="font-inter-bold text-sm uppercase mt-1"
                      style={{
                        color:
                          selectedArea.worstSeverity === "severe" ||
                          selectedArea.worstSeverity === "high"
                            ? colors.dangerText
                            : selectedArea.worstSeverity === "medium"
                              ? colors.warningText
                              : colors.successText,
                      }}
                    >
                      {selectedArea.worstSeverity}
                    </Text>
                  </View>
                </View>

                <View
                  className="rounded-2xl border p-3.5 gap-2"
                  style={{
                    backgroundColor: colors.cardMuted,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="font-inter-bold text-xs"
                    style={{ color: colors.text }}
                  >
                    Severity Breakdown
                  </Text>
                  <View className="flex-row items-center justify-between gap-1.5">
                    {[
                      {
                        label: "Severe",
                        val: selectedArea.severityCounts.severe,
                        bg: colors.dangerSoft,
                        tx: colors.dangerText,
                      },
                      {
                        label: "High",
                        val: selectedArea.severityCounts.high,
                        bg: colors.dangerSoft,
                        tx: colors.dangerText,
                      },
                      {
                        label: "Medium",
                        val: selectedArea.severityCounts.medium,
                        bg: colors.warningSoft,
                        tx: colors.warningText,
                      },
                      {
                        label: "Low",
                        val: selectedArea.severityCounts.low,
                        bg: colors.successSoft,
                        tx: colors.successText,
                      },
                    ].map((b) => (
                      <View
                        key={b.label}
                        className="flex-1 items-center rounded-xl py-1.5 px-2"
                        style={{ backgroundColor: b.bg }}
                      >
                        <Text
                          className="font-inter-bold text-[10px]"
                          style={{ color: b.tx }}
                        >
                          {b.label}
                        </Text>
                        <Text
                          className="font-inter-bold text-sm"
                          style={{ color: b.tx }}
                        >
                          {b.val}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View className="gap-1.5">
                  <Text
                    className="font-inter-bold text-xs"
                    style={{ color: colors.text }}
                  >
                    Clusters Along Corridor ({selectedArea.clusters.length})
                  </Text>
                  <ScrollView
                    className="max-h-40"
                    showsVerticalScrollIndicator={true}
                  >
                    <View className="gap-1.5">
                      {selectedArea.clusters.map((pt, idx) => (
                        <Touchable
                          key={pt.id || idx}
                          onPress={() => {
                            const found = clusters.find((c) => c.id === pt.id);
                            if (found) {
                              setSelectedArea(null);
                              setSelectedCluster(found);
                              setIsClusterModalVisible(true);
                              onOpenClusterDetail?.(found);
                            }
                          }}
                        >
                          <View
                            className="flex-row items-center justify-between rounded-xl border px-3 py-2"
                            style={{
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            }}
                          >
                            <View className="flex-row items-center gap-2">
                              <View
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    pt.severity === "severe" ||
                                    pt.severity === "high"
                                      ? colors.danger
                                      : pt.severity === "medium"
                                        ? colors.warning
                                        : colors.success,
                                }}
                              />
                              <Text
                                className="font-mono text-[11px]"
                                style={{ color: colors.text }}
                              >
                                {pt.position.latitude.toFixed(4)},{" "}
                                {pt.position.longitude.toFixed(4)}
                              </Text>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                              <Text
                                className="font-inter text-[11px]"
                                style={{ color: colors.textMuted }}
                              >
                                {pt.reportCount} det
                              </Text>
                              <Text
                                className="font-inter-bold text-[10px] uppercase"
                                style={{
                                  color:
                                    pt.severity === "severe" ||
                                    pt.severity === "high"
                                      ? colors.dangerText
                                      : pt.severity === "medium"
                                        ? colors.warningText
                                        : colors.successText,
                                }}
                              >
                                {pt.severity}
                              </Text>
                            </View>
                          </View>
                        </Touchable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <Touchable
                  onPress={() => {
                    const center = selectedArea.center;
                    setIsAreaModalVisible(false);
                    setManualFocus({
                      baseTarget: focusTarget,
                      coords: {
                        latitude: center.latitude,
                        longitude: center.longitude,
                        zoom: 17.5,
                        ts: Date.now(),
                      },
                    });
                  }}
                  className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5"
                  style={{ backgroundColor: colors.brand }}
                >
                  <ZoomIn size={18} color="#ffffff" />
                  <Text className="font-inter-bold text-sm text-white">
                    Zoom & Inspect on Map
                  </Text>
                </Touchable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
});

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useOptionalTheme();
  return (
    <Touchable onPress={onPress}>
      <View
        className="rounded-full border px-2.5 py-1 shadow-sm"
        style={{
          backgroundColor: active ? colors.brand : colors.card,
          borderColor: active ? colors.brand : colors.border,
        }}
      >
        <Text
          className="font-inter-bold text-[10px]"
          style={{ color: active ? "#FFFFFF" : colors.textSecondary }}
        >
          {label}
        </Text>
      </View>
    </Touchable>
  );
}
