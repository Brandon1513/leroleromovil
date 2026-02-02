// utils/rawbt.ts
import { Alert, Linking, Platform } from 'react-native';

const WIDTH = 32; // 58mm=32; 80mm=48
const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));

/* === Helpers de fecha: idénticos a Card/Modal y con zona MX === */
const getVentaDate = (v: any): Date => {
  const cand = v?.fecha_hora || v?.fecha || v?.created_at || v?.updated_at || v?.createdAt;

  if (!cand) return new Date();
  if (typeof cand === 'number') return new Date(cand);

  if (typeof cand === 'string') {
    // "YYYY-MM-DD HH:mm:ss"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cand)) {
      const [d, t] = cand.split(' ');
      const [y, m, day] = d.split('-').map(Number);
      const [hh, mm, ss] = t.split(':').map(Number);
      return new Date(y, m - 1, day, hh, mm, ss);
    }
    // "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(cand)) {
      const [y, m, day] = cand.split('-').map(Number);
      return new Date(y, m - 1, day, 0, 0, 0);
    }
    const d = new Date(cand); // ISO, etc.
    if (!isNaN(d.getTime())) return d;
  }

  return new Date(cand);
};

const formatDateTimeMX = (d: Date): string =>
  new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);

/* === helpers de texto para ticket === */
const pad = (s = '', w = WIDTH, align: 'L' | 'R' | 'C' = 'L') => {
  const t = String(s ?? '');
  if (t.length >= w) return t.slice(0, w);
  const sp = ' '.repeat(w - t.length);
  if (align === 'R') return sp + t;
  if (align === 'C') {
    const L = Math.floor((w - t.length) / 2);
    const R = w - t.length - L;
    return ' '.repeat(L) + t + ' '.repeat(R);
  }
  return t + sp;
};
const line = (ch = '-') => ch.repeat(WIDTH);

/** Construye ticket SOLO TEXTO (para RawBT text endpoint) */
export function buildTextTicket(venta: any) {
  // Fecha (misma lógica que Card/Modal)
  const fechaStr: string =
    (typeof venta?.fecha_str === 'string' && venta.fecha_str) ||
    formatDateTimeMX(getVentaDate(venta));

  const cliente = venta?.cliente?.nombre ?? '';

  // ===== Pago / estado (igual que en el modal) =====
  const rawMetodo =
    venta?.metodo_pago ||
    venta?.forma_pago ||
    (venta?.es_credito ? 'crédito' : 'efectivo');

  const metodo = String(rawMetodo || '').toLowerCase();
  const metodoNice =
    metodo === 'tarjeta' ? 'Tarjeta'
    : metodo === 'transferencia' ? 'Transferencia'
    : metodo === 'mixto' ? 'Pago mixto'
    : metodo === 'crédito' || metodo === 'credito' ? 'Crédito'
    : 'Efectivo';

  const estadoLower = String(venta?.estado || '').toLowerCase();
  const esCreditoFlag = venta?.es_credito === 1 || venta?.es_credito === true;

  const pagado = Number(venta?.total_pagado || 0);
  const saldo  = Number(venta?.saldo_pendiente || 0);

  const venceStr =
    venta?.fecha_vencimiento
      ? new Intl.DateTimeFormat('es-MX', {
          timeZone: 'America/Mexico_City', year: '2-digit', month: '2-digit', day: '2-digit'
        }).format(getVentaDate({ fecha: venta.fecha_vencimiento }))
      : null;

  const isPagada = estadoLower === 'pagada' || saldo <= 0.01;
  const isCreditoActiva = (estadoLower === 'credito') || (esCreditoFlag && saldo > 0.01);

  let estadoTxt = 'Pendiente';
  if (isPagada) {
    estadoTxt = esCreditoFlag ? 'Pagada — crédito liquidado' : 'Pagada';
  } else if (isCreditoActiva) {
    estadoTxt = `Crédito — resta ${money(saldo)}`;
  } else if (estadoLower === 'parcial') {
    estadoTxt = `Parcial — resta ${money(saldo)}`;
  }

  // ===== Detalle de productos / devoluciones =====
  const productos =
    (venta?.detalles || [])
      .map((d: any) => {
        const name = d?.producto?.nombre ?? '';
        const qty  = Number(d?.cantidad ?? 0);
        const sub  = money(d?.subtotal ?? 0);
        const left = `${name} x ${qty}`;
        return pad(left, WIDTH - 10, 'L') + pad(sub, 10, 'R');
      })
      .join('\n') || 'Sin productos';

  const devols =
    (venta?.rechazos || [])
      .map((r: any) => {
        const left  = `${r?.producto?.nombre ?? ''} x ${Number(r?.cantidad ?? 0)}`;
        const right = (r?.motivo ?? '').slice(0, 10);
        return pad(left, WIDTH - 10, 'L') + pad(right, 10, 'R');
      })
      .join('\n');

  // ===== Cuerpo del ticket =====
  let body = '';
  body += pad('Dulces Lero Lero', WIDTH, 'C') + '\n';
  body += pad('Ticket de venta', WIDTH, 'C') + '\n';
  body += line() + '\n';
  body += `Cliente: ${cliente}\n`;
  body += `Fecha:   ${fechaStr}\n`;
  if (venta?.observaciones) body += `Obs:     ${venta.observaciones}\n`;

  // --- NUEVO: Pago / Estado / Montos / Referencia ---
  body += `Pago:    ${metodoNice}\n`;
  body += `Estado:  ${estadoTxt}${(venceStr && isCreditoActiva) ? ` · Vence: ${venceStr}` : ''}\n`;
  if (esCreditoFlag || estadoLower === 'parcial') {
    body += `Pagado:  ${money(pagado)}\n`;
    body += `Saldo:   ${money(saldo)}\n`;
  }
  if (venta?.nota_pago) {
    body += `Ref:     ${venta.nota_pago}\n`;
  }

  body += line() + '\n';
  body += 'Productos:\n' + productos + '\n';
  if (devols && devols.trim()) {
    body += line() + '\n';
    body += 'Devoluciones:\n' + devols + '\n';
  }
  body += line() + '\n';
  body += pad(`TOTAL: ${money(venta?.total)}`, WIDTH, 'R') + '\n';
  body += pad('¡Gracias por su compra!', WIDTH, 'C') + '\n\n\n';

  return body;
}


/** Imprime usando RawBT en modo TEXTO (estable, sin ESC/POS) */
export async function printWithRawBTText(venta: any) {
  if (Platform.OS === 'ios') {
    Alert.alert('No disponible', 'RawBT solo está en Android.');
    return;
  }
  try {
    const text = buildTextTicket(venta);
    const url = 'rawbt://print?text=' + encodeURIComponent(text);
    const ok = await Linking.canOpenURL(url);
    if (!ok) throw new Error('No pude abrir RawBT');
    await Linking.openURL(url);
  } catch (e: any) {
    Alert.alert('Error al imprimir', e?.message ?? 'Fallo al abrir RawBT.');
  }
}
