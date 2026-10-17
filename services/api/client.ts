import { getApiBaseUrl, API_TIMEOUT_MS } from './config';
import { tokenStorage } from './token-storage';
import { authEvents } from './auth-events';
import { authClient } from './auth-client';

export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  timeoutMs?: number;
}

/**
 * Universal HTTP Client untuk HyperGrid API.
 * Menangani automatic bearer token injection, timeout controller,
 * query string formatting, dan deserialisasi JSON.
 */
class HttpClient {
  private formatUrl(endpoint: string, params?: Record<string, any>): string {
    let fullUrl = endpoint.startsWith('http')
      ? endpoint
      : `${getApiBaseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    return fullUrl;
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, skipAuth = false, timeoutMs = API_TIMEOUT_MS, headers = {}, ...rest } = options;
    const url = this.formatUrl(endpoint, params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: 'http://localhost:8081',
      ...(headers as Record<string, string>),
    };

    if (!skipAuth) {
      try {
        const cookie = await (authClient as any).getCookie?.();
        if (cookie) {
          requestHeaders['Cookie'] = cookie;
        }
      } catch {}

      const token = await tokenStorage.getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...rest,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 204 No Content
      if (response.status === 204) {
        return null as unknown as T;
      }

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const responseData = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (
          response.status === 401 &&
          !endpoint.includes('/sign-in') &&
          !endpoint.includes('/sign-up')
        ) {
          tokenStorage.clearAll().catch(() => {});
          authEvents.notifySessionExpired();
        }

        const errorMessage =
          (typeof responseData === 'object' && (responseData?.message || responseData?.error)) ||
          `HTTP Error ${response.status}: ${response.statusText}`;
        throw new ApiError(errorMessage, response.status, responseData);
      }

      return responseData as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) {
        throw error;
      }

      const isCanceledOrTimeout =
        error.name === 'AbortError' ||
        (typeof error.message === 'string' &&
          (error.message.toLowerCase().includes('canceled') ||
            error.message.toLowerCase().includes('aborted') ||
            error.message.toLowerCase().includes('timeout')));

      if (isCanceledOrTimeout) {
        throw new ApiError(
          `Koneksi ke server timeout atau dibatalkan (${getApiBaseUrl()}). Pastikan backend aktif dan URL dapat diakses.`,
          408,
          error
        );
      }

      if (
        typeof error.message === 'string' &&
        error.message.toLowerCase().includes('network request failed')
      ) {
        throw new ApiError(
          `Gagal menghubungi backend di ${getApiBaseUrl()}. Periksa koneksi WiFi atau atur IP via tombol Settings.`,
          0,
          error
        );
      }

      throw new ApiError(error.message || 'Network request failed', 0, error);
    }
  }

  get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new HttpClient();
