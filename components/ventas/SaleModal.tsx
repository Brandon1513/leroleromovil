import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Colors } from '@/constants/Colors';
import { money } from '@/src/utils/money';

const LOGO_LOCAL      = require('@/assets/images/lerolero-logo.png');
const REMOTE_LOGO_URL = 'https://lerolerob.domcloud.dev/images/logo.png';

// ─── Helpers ─────────────────────────────────────────────────
const getVentaDate = (v: any): Date => {
  const cand = v?.fecha_hora || v?.fecha || v?.created_at || v?.createdAt;
  if (!cand) return new Date();
  if (typeof cand === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cand)) {
      const [d, t] = cand.split(' ');
      const [y, m, day] = d.split('-').map(Number);
      const [hh, mm, ss] = t.split(':').map(Number);
      return new Date(y, m - 1, day, hh, mm, ss);
    }
    const d = new Date(cand);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

const formatMX = (d: Date, withTime = true) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit', month: '2-digit', year: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });

async function cargarLogo(): Promise<string | null> {
  try {
    const tmp = FileSystem.cacheDirectory + 'logo-h';
    const dl  = await FileSystem.downloadAsync(REMOTE_LOGO_URL, tmp);
    const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
    const ct  = dl.headers['Content-Type'] || '';
    const ext = ct.includes('jpeg') ? 'jpeg' : 'png';
    return `data:image/${ext};base64,${b64}`;
  } catch {
    try {
      const asset = Asset.fromModule(LOGO_LOCAL);
      await asset.downloadAsync();
      if (!asset.localUri) return null;
      const b64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:image/png;base64,${b64}`;
    } catch { return null; }
  }
}

// ✅ Normaliza CUALQUIER estructura de rechazo/cambio que llegue
const normalizarCambios = (raw: any): any[] => {
  // Puede llegar como: rechazos, cambios, o nada
  let lista: any[] = [];
  if (Array.isArray(raw?.rechazos) && raw.rechazos.length > 0)   lista = raw.rechazos;
  else if (Array.isArray(raw?.cambios) && raw.cambios.length > 0) lista = raw.cambios;

  return lista.map((r: any) => ({
    nombre:          r?.nombre ?? r?.producto?.nombre ?? `prod#${r?.producto_id ?? '?'}`,
    cantidad:        Number(r?.cantidad ?? 0),
    motivo:          r?.motivo ?? null,
    lote:            r?.lote ?? null,
    fecha_caducidad: r?.fecha_caducidad ?? null,
    sustituciones:   Array.isArray(r?.sustituciones)
      ? r.sustituciones.map((s: any) => ({
          nombre:          s?.nombre ?? s?.producto?.nombre ?? 'Producto',
          cantidad:        Number(s?.cantidad ?? 0),
          lote:            s?.lote ?? null,
          fecha_caducidad: s?.fecha_caducidad ?? null,
        }))
      : [],
  }));
};

type Props = {
  visible: boolean;
  venta:   any;
  onClose: () => void;
  styles:  any;
  logoBase64?: string | null;
};

export default function SaleModal({ visible, venta, onClose, styles }: Props) {
  const logoRef     = useRef<string | null>(null);
  const cambiosRef  = useRef<any[]>([]);
  const detallesRef = useRef<any[]>([]);

  const [logoBase64,  setLogoBase64]  = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(false);

  // ✅ DEBUG: JSON completo de la venta para ver qué llegó

  // Sincronizar refs con la venta actual
  useEffect(() => {
    if (!venta) return;

    // ── DEBUG: mostrar estructura real ──
    const c = normalizarCambios(venta);
    cambiosRef.current  = c;
    detallesRef.current = venta?.detalles ?? [];
  }, [venta]);

  useEffect(() => { logoRef.current = logoBase64; }, [logoBase64]);

  useEffect(() => {
    if (!visible) return;
    setLoadingLogo(true);
    cargarLogo().then(b64 => {
      setLogoBase64(b64);
      logoRef.current = b64;
      setLoadingLogo(false);
    });
  }, [visible]);

  if (!venta) return null;

  const fechaMX   = formatMX(getVentaDate(venta), true);
  const detalles  = venta?.detalles ?? [];
  const cambios   = normalizarCambios(venta);

  const rawMetodo = String(
    venta?.metodo_pago || venta?.forma_pago ||
    (venta?.es_credito ? 'credito' : 'efectivo')
  ).toLowerCase();

  const metodoNice =
    rawMetodo === 'tarjeta'        ? 'Tarjeta'
    : rawMetodo === 'transferencia'? 'Transferencia'
    : rawMetodo === 'mixto'        ? 'Pago mixto'
    : rawMetodo === 'credito' || rawMetodo === 'crédito' ? 'Crédito'
    : 'Efectivo';

  const estadoLower   = String(venta?.estado || '').toLowerCase();
  const esCreditoFlag = venta?.es_credito === 1 || venta?.es_credito === true;
  const pagado  = Number(venta?.total_pagado    ?? 0);
  const saldo   = Number(venta?.saldo_pendiente ?? 0);
  const venceStr = venta?.fecha_vencimiento
    ? formatMX(getVentaDate({ fecha: venta.fecha_vencimiento }), false) : null;
  const isPagada        = estadoLower === 'pagada' || saldo <= 0.01;
  const isCreditoActiva = estadoLower === 'credito' || (esCreditoFlag && saldo > 0.01);

  let estadoTxt = 'Pendiente';
  if (isPagada)             estadoTxt = esCreditoFlag ? 'Pagada — crédito liquidado' : 'Pagada';
  else if (isCreditoActiva) estadoTxt = `Crédito — resta ${money(saldo)}`;
  else if (estadoLower === 'parcial') estadoTxt = `Parcial — resta ${money(saldo)}`;

  const generarHTML = (): string => {
    const logo  = logoRef.current;
    const dets  = detallesRef.current;
    const lista = cambiosRef.current;

    const htmlProductos = dets.length === 0 ? '<div>Sin productos</div>'
      : dets.map((d: any) => {
          const nombre = d?.producto?.nombre ?? `prod#${d?.producto_id}`;
          const sub = Number(d?.subtotal ?? 0)
            || (Number(d?.cantidad ?? 0) * Number(d?.producto?.precio ?? d?.precio_unitario ?? 0));
          return `<div style="margin-bottom:6px">
            <div><strong>${nombre}</strong> x ${d.cantidad} = ${money(sub)}</div>
            <div style="font-size:10px;margin-left:12px;color:#444">
              Lote: ${d.lote || 'N/D'} - Caduca: ${d.fecha_caducidad || 'N/D'}
            </div></div>`;
        }).join('');

    const htmlCambios = lista.length === 0 ? '' : lista.map((c: any) => {
      const sust = (c.sustituciones || []).map((s: any) =>
        `<div style="font-size:10px;margin-left:24px;margin-top:2px">
          • ${s.nombre} x ${s.cantidad}
          <div style="margin-left:12px;color:#444">Lote: ${s.lote || 'N/D'} - Caduca: ${s.fecha_caducidad || 'N/D'}</div>
        </div>`).join('');
      return `<div style="margin-bottom:8px">
        <div><strong>📦 ${c.nombre}</strong> x ${c.cantidad} — Motivo: ${c.motivo || 'N/D'}</div>
        <div style="font-size:10px;margin-left:12px;color:#444">Lote: ${c.lote || 'N/D'} - Caduca: ${c.fecha_caducidad || 'N/D'}</div>
        ${sust ? `<div style="margin-top:4px;margin-left:12px">
          <strong style="font-size:11px;color:#065F46">✅ Entregado (sustitución):</strong>${sust}
        </div>` : ''}
      </div>`;
    }).join('');

    const css = `
      @page{size:72mm auto;margin:0}
      html,body{width:72mm;margin:0;padding:0;font-size:14px;line-height:1.35;
        font-family:-apple-system,Roboto,Arial,sans-serif;color:#000;
        -webkit-print-color-adjust:exact;print-color-adjust:exact}
      .wrap{width:72mm;padding:8px 10px;box-sizing:border-box}
      .c{text-align:center}.b{font-weight:bold}
      .s{margin:8px 0}.ln{border-top:1px dashed #000;margin:8px 0}
      img.logo{display:block;margin:0 auto 6px;max-width:220px;width:100%}
    `;

    return `<html><head><meta charset="utf-8"/><style>${css}</style></head>
    <body><div class="wrap">
      <div class="c">
        ${logo ? `<img class="logo" src="${logo}" width="120"/>` : ''}
        <div class="b">Dulces Lero Lero</div>
        <div class="ln"></div>
        <div class="b">🧾 Ticket de Venta</div>
      </div>
      <div class="s">
        <div><strong>Cliente:</strong> ${venta?.cliente?.nombre || ''}</div>
        <div><strong>Fecha:</strong> ${fechaMX}</div>
        ${venta?.observaciones ? `<div><strong>Obs:</strong> ${venta.observaciones}</div>` : ''}
      </div>
      <div class="s">
        <div><strong>Método de pago:</strong> ${metodoNice}</div>
        <div><strong>Estado:</strong> ${estadoTxt}${venceStr && isCreditoActiva ? ` (Vence: ${venceStr})` : ''}</div>
        ${esCreditoFlag || estadoLower === 'parcial'
          ? `<div><strong>Pagado:</strong> ${money(pagado)} · <strong>Saldo:</strong> ${money(saldo)}</div>` : ''}
        ${venta?.nota_pago ? `<div><strong>Ref:</strong> ${venta.nota_pago}</div>` : ''}
      </div>
      <div class="ln"></div>
      <div class="s"><div><strong>Productos:</strong></div>${htmlProductos}</div>
      ${lista.length ? `<div class="ln"></div>
        <div class="s">
          <div><strong>♻️ Cambios:</strong></div>${htmlCambios}
        </div>` : ''}
      <div class="ln"></div>
      <div class="c b">Total: ${money(Number(venta?.total ?? 0))}</div>
      <div class="c" style="margin-top:6px">¡Gracias por tu compra!</div>
    </div></body></html>`;
  };

  const handlePDF = async () => {
    try {
      const html = generarHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri);
    } catch (e: any) { Alert.alert('Error PDF', e?.message ?? 'Error'); }
  };

  const handlePrint = async () => {
    try {
      const html = generarHTML();
      await Print.printAsync({ html });
    } catch (e: any) { Alert.alert('Error imprimir', e?.message ?? 'Error'); }
  };

  const chip    = { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' as const, backgroundColor: '#EEF2FF' };
  const chipTxt = { fontSize: 12, fontWeight: '700' as const, color: '#3730A3' };
  const note    = { fontSize: 12, color: '#6B7280', marginTop: 4 };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>

          <View style={styles.modalHeader}>
            <Text style={styles.sheetTitle}>🧾 Detalle de Venta</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>

            {/* ── META ── */}
            <Text style={styles.meta}>
              Cliente: <Text style={{ fontWeight: '700' }}>{venta?.cliente?.nombre ?? ''}</Text>
            </Text>
            <Text style={styles.meta}>Fecha: {fechaMX}</Text>

            {/* ── PAGO ── */}
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.meta, { marginRight: 8 }]}>Pago:</Text>
                <View style={chip}><Text style={chipTxt}>{metodoNice}</Text></View>
              </View>
              <Text style={note}>
                {estadoTxt}{venceStr && isCreditoActiva ? ` · Vence: ${venceStr}` : ''}
              </Text>
              {esCreditoFlag
                ? <Text style={note}>Pagado: {money(pagado)} · Saldo: {money(saldo)}</Text>
                : null}
              {venta?.nota_pago
                ? <Text style={note}>Referencia: {venta.nota_pago}</Text> : null}
            </View>

            {/* ── PRODUCTOS ── */}
            <Text style={styles.sectionTitle}>🧂 Productos</Text>
            {detalles.length === 0
              ? <Text style={note}>Sin productos</Text>
              : detalles.map((d: any, i: number) => {
                  const sub = Number(d?.subtotal ?? 0)
                    || (Number(d?.cantidad ?? 0) * Number(d?.producto?.precio ?? d?.precio_unitario ?? 0));
                  return (
                    <View key={i} style={styles.detailRow}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.detailMain}>
                          {d?.producto?.nombre ?? `prod#${d?.producto_id}`} x {d?.cantidad}
                        </Text>
                        <Text style={styles.detailSub}>{money(sub)}</Text>
                      </View>
                      <Text style={styles.detailMeta}>
                        Lote: {d?.lote || 'N/D'} · Caduca: {d?.fecha_caducidad || 'N/D'}
                      </Text>
                    </View>
                  );
                })
            }

            {/* ── CAMBIOS ── */}
            {cambios.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                  ♻️ Cambios (devuelto / entregado)
                </Text>
                {cambios.map((c: any, i: number) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <View style={[styles.detailRow, {
                      backgroundColor: '#FFF7F7',
                      borderLeftWidth: 3, borderLeftColor: '#EF4444',
                    }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.detailMain}>📦 {c.nombre} x {c.cantidad}</Text>
                        <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>
                            {String(c.motivo || 'N/D').replace(/_/g, ' ')}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.detailMeta}>
                        Lote: {c.lote || 'N/D'} · Caduca: {c.fecha_caducidad || 'N/D'}
                      </Text>
                    </View>
                    {c.sustituciones.length > 0 && (
                      <View style={{ marginTop: 4, marginLeft: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#065F46', marginBottom: 4 }}>
                          ✅ Entregado (sustitución):
                        </Text>
                        {c.sustituciones.map((s: any, j: number) => (
                          <View key={j} style={[styles.detailRow, {
                            backgroundColor: '#F0FDF4',
                            borderLeftWidth: 3, borderLeftColor: '#10B981',
                          }]}>
                            <Text style={styles.detailMain}>{s.nombre} x {s.cantidad}</Text>
                            <Text style={styles.detailMeta}>
                              Lote: {s.lote || 'N/D'} · Caduca: {s.fecha_caducidad || 'N/D'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </>
            ) : null}

            {/* ── TOTAL ── */}
            <Text style={[styles.sectionTitle, { marginTop: 12, fontSize: 16 }]}>
              Total: {money(Number(venta?.total ?? 0))}
            </Text>

          </ScrollView>

          {/* ── ACCIONES ── */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E5E7EB' }]} onPress={onClose}>
              <Ionicons name="close-circle-outline" size={18} color="#111827" />
              <Text style={[styles.actionText, { color: '#111827' }]}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981' }, loadingLogo && { opacity: 0.65 }]}
              onPress={handlePrint} disabled={loadingLogo}>
              {loadingLogo
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="print-outline" size={18} color="#fff" />}
              <Text style={[styles.actionText, { color: '#fff' }]}>
                {loadingLogo ? 'Espera...' : 'Imprimir ticket'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#3B82F6' }, loadingLogo && { opacity: 0.65 }]}
              onPress={handlePDF} disabled={loadingLogo}>
              {loadingLogo
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="document-outline" size={18} color="#fff" />}
              <Text style={[styles.actionText, { color: '#fff' }]}>
                {loadingLogo ? 'Preparando...' : 'Compartir PDF'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}