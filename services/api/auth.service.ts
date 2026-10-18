import { authClient } from './auth-client';
import { tokenStorage } from './token-storage';
import type {
  AuthResponse,
  AuthSessionResponse,
  AuthUser,
  SignInEmailDto,
  SignUpEmailDto,
} from '@/types/api';

/**
 * Service Autentikasi HyperGrid berbasis SDK resmi Better-Auth.
 * Mengintegrasikan authClient (@better-auth/expo + better-auth/react)
 * dengan sinkronisasi SecureStore, session refresh, dan OAuth.
 */
export const authService = {
  /**
   * Pendaftaran akun petugas baru menggunakan Better-Auth SDK
   */
  async signUp(dto: SignUpEmailDto): Promise<AuthResponse> {
    const { data, error } = await authClient.signUp.email({
      email: dto.email.trim(),
      password: dto.password,
      name: dto.name.trim(),
    });

    if (error) {
      throw new Error(error.message || 'Failed to sign up');
    }

    const user: AuthUser = {
      id: data?.user?.id || 'usr_' + Date.now(),
      email: data?.user?.email || dto.email.trim(),
      name: data?.user?.name || dto.name.trim(),
      image: (data?.user as any)?.image ?? null,
      isOnboarded: false,
    };

    const token = (data as any)?.token || (data as any)?.session?.token || '';
    if (token) {
      await tokenStorage.setToken(token);
    }
    await tokenStorage.setUser(user);

    return { token, user };
  },

  /**
   * Masuk akun petugas menggunakan Better-Auth SDK
   */
  async signIn(dto: SignInEmailDto): Promise<AuthResponse> {
    const { data, error } = await authClient.signIn.email({
      email: dto.email.trim(),
      password: dto.password,
    });

    if (error) {
      throw new Error(error.message || 'Invalid email or password');
    }

    const user: AuthUser = {
      id: data?.user?.id || 'usr_' + Date.now(),
      email: data?.user?.email || dto.email.trim(),
      name: data?.user?.name || 'Petugas HyperGrid',
      image: (data?.user as any)?.image ?? null,
      isOnboarded: (data?.user as any)?.isOnboarded ?? false,
    };

    const token = (data as any)?.token || (data as any)?.session?.token || '';
    if (token) {
      await tokenStorage.setToken(token);
    }
    await tokenStorage.setUser(user);

    return { token, user };
  },

  /**
   * Masuk akun menggunakan Google OAuth via Better-Auth Expo SDK
   */
  async signInWithGoogle(): Promise<AuthResponse | null> {
    try {
      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        // PENTING: Gunakan relative path saja.
        // Plugin @better-auth/expo/client akan OTOMATIS mengkonversi ini
        // ke deep link sesuai scheme (hypergrid://auth/callback atau
        // exp://... di Expo Go). Jangan pakai Linking.createURL() di sini
        // karena hasilnya adalah full URL yang tidak bisa di-intercept plugin.
        callbackURL: '/auth/callback',
      });

      if (error) {
        throw new Error(error.message || 'Google sign-in failed');
      }

      // Ambil sesi aktif yang baru diverifikasi
      const sessionData = await this.getSession();
      if (sessionData?.user) {
        const token = (await tokenStorage.getToken()) || sessionData.session?.token || '';
        return {
          token,
          user: sessionData.user,
        };
      }

      if (data && 'user' in data && (data as any).user) {
        return {
          token: (data as any)?.token || '',
          user: (data as any).user as AuthUser,
        };
      }
    } catch (error) {
      console.warn('[authService] Google OAuth flow cancelled or failed:', error);
      throw error;
    }

    return null;
  },

  /**
   * Keluar dari sesi aplikasi via Better-Auth SDK
   */
  async signOut(): Promise<{ success: boolean }> {
    try {
      await (authClient.signOut as any)();
    } catch (error) {
      console.warn('[authService] Better-Auth signOut error:', error);
    } finally {
      await tokenStorage.clearAll();
    }
    return { success: true };
  },

  /**
   * Verifikasi sesi aktif petugas via Better-Auth SDK
   */
  async getSession(): Promise<AuthSessionResponse | null> {
    try {
      const { data, error } = await (authClient.getSession as any)();
      if (error || !data?.user) {
        return null;
      }

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || 'Petugas HyperGrid',
        image: (data.user as any)?.image ?? null,
        isOnboarded: (data.user as any)?.isOnboarded ?? false,
      };

      await tokenStorage.setUser(user);

      const session = {
        id: data.session?.id || 'sess_' + Date.now(),
        userId: data.user.id,
        expiresAt: data.session?.expiresAt
          ? new Date(data.session.expiresAt).toISOString()
          : new Date(Date.now() + 86400000).toISOString(),
        token: (data.session as any)?.token || (await tokenStorage.getToken()) || '',
      };

      if (session.token) {
        await tokenStorage.setToken(session.token);
      }

      return { session, user };
    } catch {
      return null;
    }
  },

  /**
   * Tandai proses onboarding selesai
   */
  async completeOnboarding(): Promise<void> {
    await tokenStorage.setOnboardingCompleted(true);
    const user = await tokenStorage.getUser<AuthUser>();
    if (user) {
      await tokenStorage.setUser({ ...user, isOnboarded: true });
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
    const session = await this.getSession();
    if (session?.user) return true;
    const token = await tokenStorage.getToken();
    return Boolean(token);
  },
};
