import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { apiClient } from './client';
import { tokenStorage } from './token-storage';
import type {
  AuthResponse,
  AuthSessionResponse,
  AuthUser,
  SignInEmailDto,
  SignUpEmailDto,
} from '@/types/api';

/**
 * Service Autentikasi HyperGrid (Better-Auth).
 * Mengelola pendaftaran, login email, login Google OAuth, validasi sesi token, dan update profil.
 */
export const authService = {
  /**
   * Pendaftaran akun petugas baru
   * POST /api/auth/sign-up/email
   */
  async signUp(dto: SignUpEmailDto): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>('/auth/sign-up/email', dto, {
      skipAuth: true,
    });

    if (data?.token) {
      await tokenStorage.setToken(data.token);
    }
    if (data?.user) {
      await tokenStorage.setUser(data.user);
    }

    return data;
  },

  /**
   * Masuk akun petugas
   * POST /api/auth/sign-in/email
   */
  async signIn(dto: SignInEmailDto): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>('/auth/sign-in/email', dto, {
      skipAuth: true,
    });

    if (data?.token) {
      await tokenStorage.setToken(data.token);
    }
    if (data?.user) {
      await tokenStorage.setUser(data.user);
    }

    return data;
  },

  /**
   * Masuk akun menggunakan Google OAuth (Better-Auth Social Provider)
   * POST /api/auth/sign-in/social
   */
  async signInWithGoogle(): Promise<AuthResponse | null> {
    const callbackURL = Linking.createURL('/auth/callback');
    try {
      const socialData = await apiClient.post<{ url: string; redirect: boolean }>(
        '/auth/sign-in/social',
        {
          provider: 'google',
          callbackURL,
        },
        {
          skipAuth: true,
          headers: {
            Origin: 'http://localhost:8081',
          },
        }
      );

      if (socialData?.url) {
        const authResult = await WebBrowser.openAuthSessionAsync(
          socialData.url,
          callbackURL
        );

        if (authResult.type === 'success' && authResult.url) {
          try {
            const urlObj = new URL(authResult.url);
            const token = urlObj.searchParams.get('token');
            if (token) {
              await tokenStorage.setToken(token);
            }
          } catch {
            // Abaikan parsing URL jika format skema custom
          }
        }

        // Ambil sesi aktif yang baru terbentuk
        const sessionData = await this.getSession();
        if (sessionData?.user) {
          return {
            token: (await tokenStorage.getToken()) || '',
            user: sessionData.user,
          };
        }
      }
    } catch (error) {
      console.warn('[authService] Google OAuth flow cancelled or failed:', error);
      throw error;
    }

    return null;
  },

  /**
   * Keluar dari sesi aplikasi
   * POST /api/auth/sign-out
   */
  async signOut(): Promise<{ success: boolean }> {
    try {
      const res = await apiClient.post<{ success: boolean }>('/auth/sign-out', {});
      await tokenStorage.clearAll();
      return res || { success: true };
    } catch (error) {
      // Pastikan token lokal tetap dibersihkan meskipun server error
      await tokenStorage.clearAll();
      return { success: true };
    }
  },

  /**
   * Verifikasi sesi aktif petugas
   * GET /api/auth/get-session
   */
  async getSession(): Promise<AuthSessionResponse | null> {
    const token = await tokenStorage.getToken();
    if (!token) return null;

    try {
      const response = await apiClient.get<AuthSessionResponse>('/auth/get-session');
      if (response?.user) {
        await tokenStorage.setUser(response.user);
      }
      return response;
    } catch (error) {
      // Jika token expired (401), bersihkan storage
      await tokenStorage.clearAll();
      return null;
    }
  },

  /**
   * Ambil data user yang tersimpan di cache lokal
   */
  async getStoredUser<T = any>(): Promise<T | null> {
    return tokenStorage.getUser<T>();
  },

  /**
   * Memperbarui profil petugas di penyimpanan lokal
   */
  async updateProfile(updates: Partial<AuthUser> & Record<string, any>): Promise<AuthUser> {
    const current = (await tokenStorage.getUser<AuthUser>()) || {
      id: 'usr_default',
      name: 'Petugas HyperGrid',
      email: 'petugas@hypergrid.io',
    };
    const updated = { ...current, ...updates };
    await tokenStorage.setUser(updated);
    return updated as AuthUser;
  },

  /**
   * Cek apakah user sedang login
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await tokenStorage.getToken();
    return Boolean(token);
  },
};
