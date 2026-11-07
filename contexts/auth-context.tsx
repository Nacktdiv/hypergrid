import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authService } from '@/services/api/auth.service';
import { authEvents } from '@/services/api/auth-events';
import type { AuthUser, SignInEmailDto, SignUpEmailDto, AuthResponse } from '@/types/api';

import { tokenStorage } from '@/services/api/token-storage';
import { defaultEdgeDetector } from '@/edge-ai/detector';

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiredNotice: string | null;
  isOnboardingCompleted: boolean;
  completeOnboarding: () => Promise<void>;
  clearSessionExpiredNotice: () => void;
  signIn: (dto: SignInEmailDto) => Promise<AuthResponse>;
  signUp: (dto: SignUpEmailDto) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse | null>;
  updateProfile: (updates: Partial<AuthUser> & Record<string, any>) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);



export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(false);

  const clearSessionExpiredNotice = useCallback(() => {
    setSessionExpiredNotice(null);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await authService.completeOnboarding();
    setIsOnboardingCompleted(true);
    setUser((prev) => (prev ? { ...prev, isOnboarded: true } : prev));
  }, []);

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 0. Cek status onboarding lokal
      const localOnboarded = await tokenStorage.isOnboardingCompleted();

      // 1. Cek cache user di penyimpanan lokal terlebih dahulu
      const stored = await authService.getStoredUser<AuthUser>();
      if (stored) {
        setUser(stored);
        if (stored.isOnboarded) {
          setIsOnboardingCompleted(true);
        } else {
          setIsOnboardingCompleted(localOnboarded);
        }
      } else {
        setIsOnboardingCompleted(localOnboarded);
      }

      // 2. Validasi ke server backend (Better-Auth)
      const sessionData = await authService.getSession();
      if (sessionData?.user) {
        setUser(sessionData.user);
        const serverOnboarded = Boolean(sessionData.user.isOnboarded || localOnboarded);
        setIsOnboardingCompleted(serverOnboarded);
        if (sessionData.user.isOnboarded) {
          await tokenStorage.setOnboardingCompleted(true);
        }
      } else {
        // Jika server menolak sesi / sesi tidak ada
        setUser(null);
      }
    } catch (err: any) {
      console.warn('[AuthProvider] Pemeriksaan sesi gagal (jaringan/server offline):', err);
      // Jika error terjadi karena jaringan offline / server timeout, pertahankan user dari cache lokal
      const stored = await authService.getStoredUser<AuthUser>().catch(() => null);
      if (!stored) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Inisialisasi awal & mendengarkan event 401 Session Expired dari API client
  useEffect(() => {
    checkSession();

    // Dengarkan event session expired dari interceptor API
    const unsubscribe = authEvents.subscribe((reason) => {
      console.log('[AuthProvider] Sesi berakhir terdeteksi dari interceptor network.');
      setUser(null);
      setSessionExpiredNotice(reason || 'Your session has expired. Please sign in again.');
    });

    return () => {
      unsubscribe();
    };
  }, [checkSession]);

  // Sinkronkan ID pengguna terautentikasi ke Edge Detector (agar data deteksi melekat pada akun sendiri)
  useEffect(() => {
    defaultEdgeDetector.setUserId(user?.id ?? null);
  }, [user]);

  const signIn = async (dto: SignInEmailDto) => {
    setIsLoading(true);
    setError(null);
    setSessionExpiredNotice(null);
    try {
      const res = await authService.signIn(dto);
      setUser(res.user);
      const isDone = Boolean(res.user.isOnboarded);
      setIsOnboardingCompleted(isDone);
      if (isDone) {
        await tokenStorage.setOnboardingCompleted(true);
      }
      return res;
    } catch (err: any) {
      const msg = err.message || 'Gagal masuk akun';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (dto: SignUpEmailDto) => {
    setIsLoading(true);
    setError(null);
    setSessionExpiredNotice(null);
    try {
      const res = await authService.signUp(dto);
      setUser(res.user);
      setIsOnboardingCompleted(false);
      await tokenStorage.setOnboardingCompleted(false);
      return res;
    } catch (err: any) {
      const msg = err.message || 'Gagal mendaftar akun';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    setSessionExpiredNotice(null);
    try {
      const res = await authService.signInWithGoogle();
      if (res?.user) {
        setUser(res.user);
        const isDone = Boolean(res.user.isOnboarded);
        setIsOnboardingCompleted(isDone);
        if (isDone) {
          await tokenStorage.setOnboardingCompleted(true);
        }
      }
      return res;
    } catch (err: any) {
      const msg = err.message || 'Gagal masuk dengan Google';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<AuthUser> & Record<string, any>) => {
    try {
      const updated = await authService.updateProfile(updates);
      setUser(updated);
      return updated;
    } catch (err: any) {
      const msg = err.message || 'Gagal memperbarui profil';
      setError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      setSessionExpiredNotice(null);
    } catch (err: any) {
      console.warn('[AuthProvider] Logout error:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    sessionExpiredNotice,
    isOnboardingCompleted,
    completeOnboarding,
    clearSessionExpiredNotice,
    signIn,
    signUp,
    signInWithGoogle,
    updateProfile,
    signOut,
    refreshSession: checkSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
