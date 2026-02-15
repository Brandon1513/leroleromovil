// src/api/apiClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_BASE_URL } from '@/constants/Config';
import Toast from 'react-native-toast-message';

/**
 * ✅ API CLIENT MEJORADO
 * 
 * Características:
 * - Manejo automático de token
 * - Retry en caso de fallo de red
 * - Timeout configurable
 * - Detección de token expirado (401)
 * - Logging de errores
 */

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos
  retryAttempts: 3,
  retryDelay: 1000, // 1 segundo
};

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
  retries?: number;
  skipErrorToast?: boolean;
};

/**
 * Cliente HTTP mejorado con retry y manejo de errores
 */
export async function apiFetch(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    skipAuth = false,
    retries = API_CONFIG.retryAttempts,
    skipErrorToast = false,
    ...fetchOptions
  } = options;

  // Preparar headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...fetchOptions.headers,
  };

  // Agregar token si no se skipea auth
  if (!skipAuth) {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      console.warn('⚠️ No token found, redirecting to login');
      router.replace('/(auth)/login');
      throw new Error('No token found');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_CONFIG.baseURL}${endpoint}`;

  let lastError: Error | null = null;

  // Reintentar hasta N veces
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`🔵 [${attempt + 1}/${retries + 1}] ${fetchOptions.method || 'GET'} ${endpoint}`);

      // Crear AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`⏱️ Request timeout después de ${API_CONFIG.timeout}ms`);
      }, API_CONFIG.timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ✅ Request exitoso (aunque sea 4xx o 5xx)
      console.log(`✅ Response: ${response.status} ${response.statusText}`);

      // 🔐 Manejar token expirado (401)
      if (response.status === 401) {
        console.warn('🔴 Token expirado (401), limpiando sesión...');
        await AsyncStorage.removeItem('authToken');
        router.replace('/(auth)/login');
        
        if (!skipErrorToast) {
          Toast.show({
            type: 'error',
            text1: 'Sesión expirada',
            text2: 'Por favor inicia sesión nuevamente',
          });
        }
        
        throw new Error('Sesión expirada');
      }

      // 🔄 Reintentar en caso de errores 5xx (servidor)
      if (response.status >= 500 && attempt < retries) {
        console.warn(`🟡 Error del servidor (${response.status}), reintentando...`);
        await sleep(API_CONFIG.retryDelay * (attempt + 1));
        continue; // Siguiente intento
      }

      // Retornar respuesta (incluso si es 4xx, para que el caller maneje el error)
      return response;

    } catch (error: any) {
      lastError = error;

      // Errores de red comunes
      if (error.name === 'AbortError') {
        console.error('⏱️ Timeout - Request abortado');
        lastError = new Error('Tiempo de espera agotado. Verifica tu conexión.');
      } else if (error.message === 'Network request failed') {
        console.error('📡 Error de red - Sin conexión');
        lastError = new Error('Sin conexión a internet. Verifica tu red.');
      } else {
        console.error('❌ Error inesperado:', error.message);
      }

      // Si es el último intento, lanzar error
      if (attempt === retries) {
        console.error(`🔴 Falló después de ${attempt + 1} intentos`);
        
        if (!skipErrorToast) {
          Toast.show({
            type: 'error',
            text1: 'Error de conexión',
            text2: lastError?.message || 'No se pudo conectar al servidor',
          });
        }
        
        throw lastError;
      }

      // Esperar antes de reintentar (backoff exponencial)
      console.log(`⏳ Reintentando en ${API_CONFIG.retryDelay * (attempt + 1)}ms...`);
      await sleep(API_CONFIG.retryDelay * (attempt + 1));
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * Helper: Sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper: GET request
 */
export async function apiGet(endpoint: string, options?: FetchOptions) {
  return apiFetch(endpoint, { ...options, method: 'GET' });
}

/**
 * Helper: POST request
 */
export async function apiPost(endpoint: string, body: any, options?: FetchOptions) {
  return apiFetch(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Helper: PUT request
 */
export async function apiPut(endpoint: string, body: any, options?: FetchOptions) {
  return apiFetch(endpoint, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Helper: DELETE request
 */
export async function apiDelete(endpoint: string, options?: FetchOptions) {
  return apiFetch(endpoint, { ...options, method: 'DELETE' });
}

/**
 * ✅ Helper: Validar respuesta JSON
 */
export async function validateJsonResponse<T = any>(response: Response): Promise<T> {
  if (!response.ok) {
    // Intentar obtener mensaje de error del servidor
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData?.message || errorMessage;
    } catch {
      // Si no es JSON, usar statusText
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta inválida del servidor');
  }

  return data as T;
}

/*
|--------------------------------------------------------------------------
| EJEMPLO DE USO
|--------------------------------------------------------------------------
|
| // En cualquier pantalla:
| import { apiGet, apiPost, validateJsonResponse } from '@/src/api/apiClient';
|
| // GET simple:
| const response = await apiGet('/api/clientes');
| const clientes = await validateJsonResponse(response);
|
| // POST con body:
| const response = await apiPost('/api/venta', ventaData);
| const result = await validateJsonResponse(response);
|
| // Con manejo de errores:
| try {
|   const response = await apiGet('/api/inventario');
|   const inventario = await validateJsonResponse(response);
| } catch (error: any) {
|   // El error ya fue mostrado en Toast automáticamente
|   console.error('Error:', error.message);
| }
|
|--------------------------------------------------------------------------
*/