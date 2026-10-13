/**
 * Event Emitter sederhana untuk sinkronisasi state autentikasi & sesi
 * antara Network Client (interceptor 401) dan UI Layout / Auth Context.
 */

type AuthEventListener = (reason?: string) => void;

class AuthEventManager {
  private listeners: AuthEventListener[] = [];

  subscribe(listener: AuthEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifySessionExpired(reason = "Sesi Anda telah berakhir atau database telah di-reset. Silakan masuk kembali."): void {
    this.listeners.forEach((listener) => {
      try {
        listener(reason);
      } catch (e) {
        console.warn("[AuthEventManager] Error in listener:", e);
      }
    });
  }
}

export const authEvents = new AuthEventManager();
