// utils/draftSale.ts - VERSIÓN CORREGIDA
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_KEY = 'venta_borrador_v1';
const KEY_PREFIX = 'venta_borrador_v2:';
const AUTH_USER_KEY = 'authUser';

export type DraftSale = {
  draft_id: string;
  cliente: { id: number; nombre?: string | null } | null;
  carrito: any[];
  observaciones: string;
  cambiosVenta: any[];
  startedAt: string;
  client_tx_id: string;
  es_credito?: boolean;
  pagos?: { efectivo?: string; transferencia?: string; tarjeta?: string };
  nota_pago?: string;
  vence?: string;
  total?: number;
};

type AuthUser = { id: number; name?: string; email?: string };

export async function setAuthUser(user: AuthUser) {
  try {
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {}
}


export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function getAuthUserId(): Promise<number | null> {
  const u = await getAuthUser();
  return u?.id ?? null;
}

const keyFor = (userId: number | null) => (userId ? `${KEY_PREFIX}${userId}` : LEGACY_KEY);

const safeJson = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// ✅ NUEVA FUNCIÓN: Validación estricta de borrador
const normalizeDraft = (d: any): DraftSale | null => {
  if (!d || typeof d !== 'object') return null;

  const clienteId = Number(d?.cliente?.id ?? 0);
  
  // ❌ CRÍTICO: Sin cliente válido, NO es borrador
  if (!clienteId || clienteId <= 0) return null;

  const carritoRaw = Array.isArray(d?.carrito) ? d.carrito : [];
  const carrito = carritoRaw.filter((x: any) => Number(x?.cantidad ?? 0) > 0);

  // ✅ NUEVA VALIDACIÓN: Debe tener contenido real
  const total = Number(d?.total ?? 0);
  const hasItems = carrito.length > 0;
  const hasTotal = total > 0;
  const hasObs = String(d?.observaciones ?? '').trim() !== '';
  const hasCambios = Array.isArray(d?.cambiosVenta) && d?.cambiosVenta.length > 0;
  
  const pagos = d?.pagos && typeof d.pagos === 'object' ? d.pagos : {};
  const hasMoney = 
    String(pagos.efectivo ?? '').trim() !== '' ||
    String(pagos.transferencia ?? '').trim() !== '' ||
    String(pagos.tarjeta ?? '').trim() !== '';

  const hasContent = hasItems || hasTotal || hasObs || hasCambios || hasMoney;

  // ❌ Si no hay contenido real, NO es un borrador válido
  if (!hasContent) return null;

  const draft: DraftSale = {
    draft_id: String(d?.draft_id ?? ''),
    cliente: { id: clienteId, nombre: d?.cliente?.nombre ?? '' },
    carrito,
    observaciones: String(d?.observaciones ?? ''),
    cambiosVenta: Array.isArray(d?.cambiosVenta) ? d.cambiosVenta : [],
    startedAt: String(d?.startedAt ?? new Date().toISOString()),
    client_tx_id: String(d?.client_tx_id ?? ''),
    es_credito: typeof d?.es_credito === 'boolean' ? d.es_credito : undefined,
    pagos: hasMoney ? pagos : undefined,
    nota_pago: String(d?.nota_pago ?? ''),
    vence: String(d?.vence ?? ''),
    total: total,
  };

  return draft;
};

export async function getDraft(): Promise<DraftSale | null> {
  try {
    const userId = await getAuthUserId();

    // 1) Intenta borrador nuevo (por usuario)
    const rawNew = await AsyncStorage.getItem(keyFor(userId));
    const parsedNew = safeJson(rawNew);
    const normalizedNew = normalizeDraft(parsedNew);
    if (normalizedNew) return normalizedNew;

    // 2) Fallback legacy
    const rawLegacy = await AsyncStorage.getItem(LEGACY_KEY);
    const parsedLegacy = safeJson(rawLegacy);
    const normalizedLegacy = normalizeDraft(parsedLegacy);
    if (normalizedLegacy) return normalizedLegacy;

    return null;
  } catch {
    return null;
  }
}

// ✅ NUEVA FUNCIÓN: setDraft con validación previa
export async function setDraft(draft: DraftSale) {
  try {
    // ❌ No guardar si no tiene cliente válido
    if (!draft?.cliente?.id || draft.cliente.id <= 0) {
      return;
    }

    // ✅ Validar que tenga contenido antes de guardar
    const normalized = normalizeDraft(draft);
    if (!normalized) {
      // Si no es válido, mejor limpiar
      await clearDraft();
      return;
    }

    const userId = await getAuthUserId();
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(normalized));
  } catch {}
}

export async function clearDraft() {
  try {
    const userId = await getAuthUserId();
    await AsyncStorage.removeItem(keyFor(userId));
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch {}
}

export async function hasDraft(): Promise<boolean> {
  return (await getDraft()) !== null;
}