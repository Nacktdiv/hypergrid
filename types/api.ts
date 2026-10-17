/**
 * HyperGrid API Types & DTO Definitions
 * Berdasarkan spesifikasi resmi backend NestJS + PostGIS + Better-Auth di `backend-documentation.md`.
 */

// Enum Status & Keparahan Kerusakan Jalan
export type PotholeSeverity = 'low' | 'medium' | 'high' | 'severe';
export type PotholeStatus = 'active' | 'verified' | 'repaired' | 'false_positive';

/**
 * Entitas Hasil Agregasi Spasial Klaster Pothole (PostGIS).
 * Format atribut: snake_case sesuai respons SQL backend.
 */
export interface PotholeCluster {
  id: string;
  center_latitude: number;
  center_longitude: number;
  severity: PotholeSeverity;
  confidence_avg: number;
  detection_count: number;
  status: PotholeStatus;
  first_detected_at: string;
  last_detected_at: string;
  updated_at: string;
  distance_meters?: number;
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
}

/**
 * Filter Query Daftar Raw Detections
 */
export interface DetectionsQueryFilter {
  limit?: number;
  search?: string;
  deviceId?: string;
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
