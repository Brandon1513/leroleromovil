import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { money } from '@/src/utils/money';
import { printWithRawBTText } from '@/src/utils/rawbt';

/* ==== Helpers de fecha (idénticos a los de SaleCard) ==== */
const getVentaDate = (v: any): Date => {
  const cand =
    v?.fecha_hora || v?.fecha || v?.created_at || v?.updated_at || v?.createdAt;

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
    // ISO (con T/Z) u otros
    const d = new Date(cand);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date(cand);
};

const formatMX = (d: Date, withTime = true) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });

type Props = {
  visible: boolean;
  venta: any;
  onClose: () => void;
  styles: any;
  logoBase64?: string | null;
};

export default function SaleModal({ visible, venta, onClose, styles, logoBase64 }: Props) {
  if (!venta) return null;

  const fechaDate = getVentaDate(venta);
  const fechaMX = formatMX(fechaDate, true);

  // ====== Pago / estado ======
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
  const esCreditoFlag =
    venta?.es_credito === 1 || venta?.es_credito === true;

  const pagado = Number(venta?.total_pagado || 0);
  const saldo  = Number(venta?.saldo_pendiente || 0);

  const venceStr =
    venta?.fecha_vencimiento
      ? formatMX(getVentaDate({ fecha: venta.fecha_vencimiento }), false)
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

  // estilos mínimos locales
  const chip = {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    alignSelf: 'flex-start', backgroundColor: '#EEF2FF'
  } as const;
  const chipTxt = { fontSize: 12, fontWeight: '700', color: '#3730A3' } as const;
  const note = { fontSize: 12, color: '#6B7280', marginTop: 4 } as const;

  const generarPDF = async () => {
    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: monospace; font-size: 12px; padding: 20px; color:#000; }
        .c { text-align:center } .b { font-weight:bold } .ln { border-top:1px dashed #000; margin:8px 0; }
      </style></head><body>
        <div class="c">
          ${logoBase64 ? `<img src="${logoBase64}" width="100" />` : ''}
          <div class="b">Dulces Lero Lero</div>
          <div class="ln"></div>
          <div class="b">🧾 Ticket de Venta</div>
        </div>
        <div><b>Cliente:</b> ${venta?.cliente?.nombre || ''}</div>
        <div><b>Fecha:</b> ${fechaMX}</div>
        <div><b>Método de pago:</b> ${metodoNice}</div>
        <div><b>Estado:</b> ${estadoTxt}${venceStr && isCreditoActiva ? ` (vence: ${venceStr})` : ''}</div>
        ${esCreditoFlag ? `<div><b>Pagado:</b> ${money(pagado)} · <b>Saldo:</b> ${money(saldo)}</div>` : ''}
        ${venta?.nota_pago ? `<div><b>Referencia:</b> ${venta.nota_pago}</div>` : ''}
        <div class="ln"></div>
        <div><b>Productos:</b></div>
        ${
          (venta?.detalles || [])
            .map(
              (d: any) =>
                `<div>${d?.producto?.nombre || ''} x ${d?.cantidad} = ${money(Number(d?.subtotal))}</div>`
            )
            .join('') || '<div>Sin productos</div>'
        }
        ${
          (venta?.rechazos?.length
            ? `
          <div class="ln"></div>
          <div><b>Devoluciones:</b></div>
          ${venta.rechazos
            .map(
              (r: any) =>
                `<div>${r?.producto?.nombre || ''} x ${r?.cantidad} - ${r?.motivo || ''}</div>`
            )
            .join('')}
        ` : '')
        }
        <div class="ln"></div>
        <div class="c b">Total: ${money(Number(venta?.total))}</div>
        <div class="c">¡Gracias por tu compra!</div>
      </body></html>
    `;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    await Sharing.shareAsync(uri);
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.sheetTitle}>🧾 Detalle de Venta</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Resumen */}
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            <Text style={styles.meta}>
              Cliente: <Text style={{ fontWeight: '700' }}>{venta?.cliente?.nombre ?? ''}</Text>
            </Text>
            <Text style={styles.meta}>Fecha: {fechaMX}</Text>

            {/* Pago */}
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.meta, { marginRight: 8 }]}>Pago:</Text>
                <View style={chip}><Text style={chipTxt}>{metodoNice}</Text></View>
              </View>
              <Text style={note}>
                {estadoTxt}{(venceStr && isCreditoActiva) ? ` · Vence: ${venceStr}` : ''}
              </Text>
              {esCreditoFlag ? (
                <Text style={note}>
                  Pagado: {money(pagado)} · Saldo pendiente: {money(saldo)}
                </Text>
              ) : null}
              {venta?.nota_pago ? (
                <Text style={note}>Referencia: {venta.nota_pago}</Text>
              ) : null}
            </View>

            {venta?.observaciones ? (
              <Text style={[styles.meta, { marginTop: 8 }]}>
                Observaciones: {venta.observaciones}
              </Text>
            ) : null}

            <Text style={styles.sectionTitle}>Productos</Text>
            {(venta?.detalles || []).length === 0 && (
              <Text style={styles.meta}>Sin productos</Text>
            )}
            {(venta?.detalles || []).map((d: any, i: number) => (
              <View key={i} style={styles.detailRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.detailMain}>
                    {d?.producto?.nombre || ''} x {d?.cantidad}
                  </Text>
                  <Text style={styles.detailSub}>{money(Number(d?.subtotal))}</Text>
                </View>
                <Text style={styles.detailMeta}>
                  Lote: {d?.lote || 'N/D'} · Caduca: {d?.fecha_caducidad || 'N/D'}
                </Text>
              </View>
            ))}

            {venta?.rechazos?.length ? (
              <>
                <Text style={styles.sectionTitle}>Devoluciones</Text>
                {venta.rechazos.map((r: any, i: number) => (
                  <View key={i} style={[styles.detailRow, { backgroundColor: '#FFF7F7' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.detailMain}>
                        {r?.producto?.nombre || ''} x {r?.cantidad}
                      </Text>
                      <Text style={[styles.detailSub, { color: '#991B1B' }]}>{r?.motivo}</Text>
                    </View>
                    <Text style={styles.detailMeta}>
                      Lote: {r?.lote || 'N/D'} · Caduca: {r?.fecha_caducidad || 'N/D'}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
              Total: {money(Number(venta?.total || 0))}
            </Text>
          </ScrollView>

          {/* Acciones */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#E5E7EB' }]} onPress={onClose}>
              <Ionicons name="close-circle-outline" size={18} color="#111827" />
              <Text style={[styles.actionText, { color: '#111827' }]}>Cerrar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
              onPress={() => printWithRawBTText(venta)}
            >
              <Ionicons name="print-outline" size={18} color="#fff" />
              <Text style={[styles.actionText, { color: '#fff' }]}>Imprimir ticket</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={generarPDF}>
              <Ionicons name="document-outline" size={18} color="#fff" />
              <Text style={[styles.actionText, { color: '#fff' }]}>Compartir PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
