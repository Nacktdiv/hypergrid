import { apiClient } from './client';
import type { HealthResponse } from '@/types/api';

/**
 * Service Health Check HyperGrid API.
 */
export const healthService = {
  /**
   * Mengecek status ketersediaan backend server.
   * Mendukung pengecekan /health dan fallback /auth/get-session.
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      return await apiClient.get<HealthResponse>('/health', {
        skipAuth: true,
        timeoutMs: 8000,
      });
    } catch (err: any) {
      // Jika server merespons HTTP 401 Unauthorized dari guard NestJS,
      // artinya server backend aktif dan menerima request HTTP!
      if (err?.status === 401 || err?.status === 200) {
        return {
          status: 'ok',
          service: 'hypergrid-server',
          timestamp: new Date().toISOString(),
        };
      }

      // Coba fallback cek ketersediaan endpoint publik Better-Auth
      try {
        await apiClient.get('/auth/get-session', {
          skipAuth: true,
          timeoutMs: 6000,
        });
        return {
          status: 'ok',
          service: 'hypergrid-server (better-auth)',
          timestamp: new Date().toISOString(),
        };
      } catch {
        throw err;
      }
    }
  },

  /**
   * Cek apakah server reachable (true/false)
   */
  async isServerReachable(): Promise<boolean> {
    try {
      const res = await this.checkHealth();
      return res?.status === 'ok';
    } catch {
      return false;
    }
  },
};
