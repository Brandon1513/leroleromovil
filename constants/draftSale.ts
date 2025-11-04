// src/utils/draftSale.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'venta_borrador_v1';

export type DraftSale = {
  cliente: any;
  carrito: any[];
  observaciones: string;
  cambiosVenta: any[];
  startedAt: string;
  client_tx_id?: string;
  es_credito?: boolean;
  pagos?: { efectivo?: string; transferencia?: string; tarjeta?: string };
  total?: number;
};

export async function getDraft(): Promise<DraftSale | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setDraft(draft: DraftSale) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(draft));
  } catch {}
}

export async function updateDraft(patch: Partial<DraftSale>) {
  const prev = (await getDraft()) ?? ({} as DraftSale);
  const next = {
    ...prev,
    ...patch,
    pagos: { ...(prev.pagos ?? {}), ...(patch.pagos ?? {}) },
  } as DraftSale;
  await setDraft(next);
  return next;
}

export async function clearDraft() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

export async function hasDraft(): Promise<boolean> {
  return (await getDraft()) !== null;
}
