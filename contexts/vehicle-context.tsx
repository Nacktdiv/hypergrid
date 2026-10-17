import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import * as SecureStore from "expo-secure-store";
import type { ImageSource } from "expo-image";

export type VehicleId = "car" | "motor" | "bicycle";

/**
 * Konfigurasi kalibrasi sensor per jenis kendaraan.
 * Disesuaikan dengan karakteristik suspensi, bobot, dan dinamika laju kendaraan rata-rata:
 *
 * 1. Mobil Penumpang (Family MPV — e.g., Avanza / Xpander):
 *    - Suspensi hidrolik lembut meredam getaran mikro jalan.
 *    - Puncak guncangan lubang pada dashboard/mount HP lebih teredam (~1.65G - 1.85G).
 *    - Filter kecepatan EMA lebih halus (alpha = 0.20) karena inersia akselerasi stabil.
 *
 * 2. Sepeda Motor (Commuter Scooter / Underbone — e.g., Vario / Beat):
 *    - Suspensi depan teleskopik terhubung langsung ke stang & mount HP.
 *    - Getaran mesin 1-silinder menghasilkan baseline getaran lebih tinggi.
 *    - Benturan lubang menghasilkan akselerasi Z tajam (2.2G - 3.2G), sehingga threshold dinaikkan
 *      ke 2.2G untuk menyaring getaran mesin/jalan bergelombang (mencegah false positive).
 *    - Filter kecepatan EMA lebih responsif (alpha = 0.35) mengikuti tarikan gas lincah.
 *
 * 3. Sepeda (City Bike / Commuter):
 *    - Tanpa mesin, kecepatan rendah (5 - 30 km/jam).
 *    - Hantaman lubang terdeteksi pada 1.9G dengan filter EMA 0.40.
 */
export interface VehicleSensorConfig {
  /** Ambang batas lonjakan akselerasi Z (dalam G) untuk memicu inferensi anomali */
  zShockThreshold: number;
  /** Pengali visualisasi vibrasi jalan m/s² */
  vibrationFactor: number;
  /** Pengali visualisasi jarum/gauge guncangan HUD (0–100) */
  shockGaugeMultiplier: number;
  /** Nilai alpha (0–1) filter low-pass EMA untuk penghalusan kecepatan GPS */
  speedEmaAlpha: number;
  /** Kecepatan minimum (km/h) untuk diklasifikasikan sebagai kendaraan bergerak */
  minMovingSpeed: number;
  /** Batas kecepatan maksimal realistis untuk eliminasi lonjakan GPS error (km/h) */
  maxSpeedGlitch: number;
  /** Ambang batas klasifikasi keparahan fallback berdasarkan puncak Z */
  severityThresholds: {
    severe: number;
    high: number;
    medium: number;
  };
}

export interface VehicleProfile {
  id: VehicleId;
  /** Label tipe kendaraan umum (US English) */
  type: string;
  /** Model kendaraan representatif (standar pasar Indonesia) */
  name: string;
  /** Keterangan kelas standar kendaraan */
  standardCategory: string;
  /** Nomor plat dinas/kendaraan uji */
  plate: string;
  /** Gambar ilustrasi kendaraan resolusi tinggi */
  image: ImageSource;
  /** Ikon marker emoji untuk peta OpenStreetMap/Leaflet */
  markerEmoji: string;
  /** Konfigurasi sensor */
  sensorConfig: VehicleSensorConfig;
}

export const VEHICLE_PROFILES: Record<VehicleId, VehicleProfile> = {
  car: {
    id: "car",
    type: "Car",
    name: "Toyota Avanza 1.5 G",
    standardCategory: "Standard Family MPV",
    plate: "B 1284 UZH",
    image: require("@/assets/vehicles/car.png"),
    markerEmoji: "🚗",
    sensorConfig: {
      zShockThreshold: 1.10, // Dynamic vertical shock di atas 1G gravitasi (total ~2.10G)
      vibrationFactor: 1.0,
      shockGaugeMultiplier: 55,
      speedEmaAlpha: 0.20,
      minMovingSpeed: 10.0,
      maxSpeedGlitch: 180,
      severityThresholds: {
        severe: 2.2,
        high: 1.6,
        medium: 1.10,
      },
    },
  },
  motor: {
    id: "motor",
    type: "Motorcycle",
    name: "Honda Vario 160 CBS",
    standardCategory: "Standard Automatic Scooter",
    plate: "B 2941 KJS",
    image: require("@/assets/vehicles/vehicle-motor.png"),
    markerEmoji: "🏍️",
    sensorConfig: {
      zShockThreshold: 1.50, // Stang motor bergetar lebih kuat, ambang shock dinamis >= 1.50G (total ~2.50G)
      vibrationFactor: 1.35,
      shockGaugeMultiplier: 35,
      speedEmaAlpha: 0.35,
      minMovingSpeed: 10.0,
      maxSpeedGlitch: 140,
      severityThresholds: {
        severe: 2.8,
        high: 2.0,
        medium: 1.50,
      },
    },
  },
  bicycle: {
    id: "bicycle",
    type: "Bicycle",
    name: "Polygon Sierra City Bike",
    standardCategory: "Standard Urban Commuter Bike",
    plate: "B 7710 TRX",
    image: require("@/assets/vehicles/vehicle-bicycle.png"),
    markerEmoji: "🚲",
    sensorConfig: {
      zShockThreshold: 1.15,
      vibrationFactor: 0.85,
      shockGaugeMultiplier: 45,
      speedEmaAlpha: 0.40,
      minMovingSpeed: 5.0,
      maxSpeedGlitch: 60,
      severityThresholds: {
        severe: 2.3,
        high: 1.7,
        medium: 1.15,
      },
    },
  },
};

const STORAGE_KEY = "hypergrid_selected_vehicle";

interface VehicleContextType {
  vehicleId: VehicleId;
  vehicleProfile: VehicleProfile;
  setVehicle: (id: VehicleId) => Promise<void>;
}

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export function VehicleProvider({ children }: { children: React.ReactNode }) {
  const [vehicleId, setVehicleIdState] = useState<VehicleId>("car");

  // Load preferensi kendaraan yang tersimpan di disk
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored && (stored === "car" || stored === "motor" || stored === "bicycle")) {
          setVehicleIdState(stored as VehicleId);
        }
      })
      .catch(() => {});
  }, []);

  const setVehicle = useCallback(async (id: VehicleId) => {
    setVehicleIdState(id);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, id);
    } catch (e) {
      console.warn("[VehicleContext] Gagal menyimpan preferensi kendaraan:", e);
    }
  }, []);

  const vehicleProfile = useMemo(() => {
    return VEHICLE_PROFILES[vehicleId] ?? VEHICLE_PROFILES.car;
  }, [vehicleId]);

  const value = useMemo(
    () => ({
      vehicleId,
      vehicleProfile,
      setVehicle,
    }),
    [vehicleId, vehicleProfile, setVehicle]
  );

  return (
    <VehicleContext.Provider value={value}>
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicle(): VehicleContextType {
  const context = useContext(VehicleContext);
  if (!context) {
    throw new Error("useVehicle must be used within a VehicleProvider");
  }
  return context;
}
