/**
 * HyperGrid API Types & DTO Definitions
 * Berdasarkan spesifikasi resmi backend NestJS + PostGIS + Better-Auth di `backend-documentation.md`.
 */

// Enum Status & Keparahan Kerusakan Jalan
export type ClusterSeverity = 'low' | 'medium' | 'high' | 'severe';
export type PotholeSeverity = ClusterSeverity; // Backward-compatibility alias
export type PotholeStatus = 'active' | 'verified' | 'repaired' | 'false_positive';

/**
 * Status Validasi Deteksi (Strict Dual-Filter: Visual + Sensor)
 * - CONFIRMED: confidence >= 0.70
 * - CONFIRMED_VIA_SENSOR: 0.50 <= confidence < 0.70 & zAccelPeak >= 2.0
 * - UNCERTAIN: 0.50 <= confidence < 0.70 & zAccelPeak < 2.0 (butuh konfirmasi DBSCAN multi-laporan)
 * - REJECTED: confidence < 0.50 atau (speedKmh > 60 & zAccelPeak < 1.2)
 */
export type DetectionValidationStatus =
  | 'CONFIRMED'
  | 'CONFIRMED_VIA_SENSOR'
  | 'UNCERTAIN'
  | 'REJECTED';

/**
 * Helper parsing & type assertion aman saat membaca field `severity`
 * dari respons query SQL/Prisma atau backend API agar tidak menimbulkan error tipe data `string`.
 */
export function parseClusterSeverity(
  val: unknown,
  fallback: ClusterSeverity = 'low'
): ClusterSeverity {
  if (typeof val !== 'string') return fallback;
  const normalized = val.trim().toLowerCase();
  switch (normalized) {
    case 'severe':
    case 'heavy':
      return 'severe';
    case 'high':
      return 'high';
    case 'medium':
    case 'moderate':
      return 'medium';
    case 'low':
    case 'light':
      return 'low';
    default:
      return fallback;
  }
}

export interface ClusterPointDetail {
  id: string;
  latitude: number;
  longitude: number;
  intensity: number;
  z_accel_peak?: number | null;
  confidence: number;
  detected_at: string;
  user_id?: string | null;
  device_id?: string;
}

/**
 * Entitas Klaster Terkonsolidasi (DBSCAN Clustering Output).
 * Mengelompokkan titik-titik deteksi valid dengan properti snake_case & camelCase
 * agar kompatibel penuh dengan query Prisma/PostGIS backend dan frontend React Native.
 */
export interface ConsolidatedCluster {
  id: string;
  center_latitude: number;
  center_longitude: number;
  centerLatitude?: number;
  centerLongitude?: number;
  severity: ClusterSeverity;
  confidence_avg: number;
  confidenceAvg?: number;
  detection_count: number;
  detectionCount?: number;
  user_count?: number;
  userCount?: number;
  status: PotholeStatus;
  first_detected_at: string;
  last_detected_at: string;
  updated_at: string;
  distance_meters?: number;
  radius_meters?: number;
  radiusMeters?: number;
  road_length_meters?: number;
  road_segment_coords?: Array<{ latitude: number; longitude: number }>;
  validation_status?: DetectionValidationStatus;
  points?: ClusterPointDetail[];
}

/**
 * Entitas Hasil Agregasi Spasial Klaster Pothole (PostGIS & DBSCAN).
 * Format atribut: snake_case sesuai respons SQL backend.
 */
export interface PotholeCluster {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: ClusterSeverity;
  confidence_avg: number;
  detection_count: number;
  user_count?: number;
  status: PotholeStatus;
  first_detected_at: string;
  last_detected_at: string;
  updated_at: string;
  distance_meters?: number;
  radius_meters?: number;
  road_length_meters?: number;
  road_segment_coords?: Array<{ latitude: number; longitude: number }>;
  points?: ClusterPointDetail[];
}

/**
 * Respons Konsolidasi DBSCAN & Heatmap dari Server
 */
export interface DbscanClustersResponse {
  clusters: PotholeCluster[];
  heatmap: [number, number, number][]; // [lat, lon, intensity 0..1]
  total_detections: number;
  total_clusters: number;
  generated_at: string;
}

/**
 * Entitas Raw Detection (Prisma ORM).
 * Format atribut: camelCase sesuai model Prisma.
 */
export interface RawDetection {
  id: string;
  deviceId: string;
  userId?: string | null;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number | null;
  zAccelPeak?: number | null;
  modelVersion: string;
  detectedAt: string;
  createdAt: string;
}

/**
 * DTO Pengiriman Deteksi Baru (Single Ingestion).
 */
export interface CreateDetectionDto {
  deviceId: string;
  userId?: string | null;
  latitude: number;
  longitude: number;
  confidence: number;
  speedKmh?: number | null;
  zAccelPeak?: number | null;
  modelVersion?: string;
  detectedAt: string;
}

/**
 * DTO Pengiriman Batch Deteksi (Bulk Ingestion).
 */
export interface CreateBatchDetectionDto {
  detections: CreateDetectionDto[];
}

export interface BatchDetectionResponse {
  count: number;
}

/**
 * DTO Update Status Klaster (Dinas PU / Verifikator)
 */
export interface UpdateClusterStatusDto {
  status: PotholeStatus;
  severity?: PotholeSeverity;
}

/**
 * DTO Update Atribut Klaster Menyeluruh
 */
export interface UpdateClusterDto {
  status?: PotholeStatus;
  severity?: PotholeSeverity;
  center_latitude?: number;
  center_longitude?: number;
  detection_count?: number;
  confidence_avg?: number;
}

/**
 * Filter Query Bounding Box / Viewport Map
 */
export interface BoundingBoxFilter {
  minLat?: number;
  minLon?: number;
  maxLat?: number;
  maxLon?: number;
  status?: PotholeStatus;
  severity?: PotholeSeverity;
  limit?: number;
  eps?: number;
  minPts?: number;
  vehicleType?: string;
}

/**
 * Filter Query Daftar Raw Detections
 */
export interface DetectionsQueryFilter {
  limit?: number;
  search?: string;
  deviceId?: string;
  userId?: string;
}

/**
 * Tipe Data Autentikasi (Better-Auth)
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  isOnboarded?: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: string;
  token: string;
}

export interface AuthSessionResponse {
  session: AuthSession;
  user: AuthUser;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface SignUpEmailDto {
  email: string;
  password: string;
  name: string;
}

export interface SignInEmailDto {
  email: string;
  password: string;
  callbackURL?: string;
}

/**
 * Health Check Response
 */
export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}
