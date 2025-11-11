// utils/pdf.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export async function generarYCompartirPDF(venta: any, logoBase64?: string | null) {
  const money = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

  const fechaFormateada = new Date(venta.fecha).toLocaleString('es-MX');
  const html = `
  <html><head><meta charset="utf-8" />
  <style>
    body { font-family: monospace; font-size: 12px; padding: 20px; color: #000; }
    .center { text-align: center; } .bold { font-weight: bold; }
    .section { margin-top: 10px; margin-bottom: 10px; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    .barcode { margin-top: 20px; text-align: center; font-size: 24px; letter-spacing: 2px; }
  </style></head><body>
    <div class="center">
      ${logoBase64 ? `<img src="${logoBase64}" width="100" />` : ''}
      <div class="bold">Dulces Lero Lero</div>
      <div class="line"></div>
      <div class="bold">🧾 Ticket de Venta</div>
    </div>
    <div class="section">
      <div><strong>Cliente:</strong> ${venta.cliente?.nombre || ''}</div>
      <div><strong>Fecha:</strong> ${fechaFormateada}</div>
      <div><strong>Observaciones:</strong> ${venta.observaciones || 'Sin observaciones'}</div>
    </div>
    <div class="line"></div>
    <div class="section">
      <div><strong>Productos:</strong></div>
      ${
        (venta.detalles || [])
          .map((d: any) =>
            `<div>${d.producto?.nombre || ''} x ${d.cantidad} = ${money(Number(d.subtotal))}</div>
             <div style="font-size:10px;color:#555">Lote: ${d.lote || 'N/D'} - Caduca: ${d.fecha_caducidad || 'N/D'}</div>`
          ).join('') || '<div>Sin productos</div>'
      }
    </div>
    <div class="line"></div>
    <div class="section">
      <div><strong>Productos Devueltos:</strong></div>
      ${
        venta.rechazos?.length
          ? venta.rechazos.map((r: any) =>
              `<div>${r.producto?.nombre || ''} x ${r.cantidad} - Motivo: ${r.motivo}</div>
               <div style="font-size:10px;color:#555">Lote: ${r.lote || 'N/D'} - Caduca: ${r.fecha_caducidad || 'N/D'}</div>`
            ).join('')
          : '<div>Sin devoluciones</div>'
      }
    </div>
    <div class="line"></div>
    <div class="center bold">Total: ${money(Number(venta.total))}</div>
    <div class="barcode">|| ||| ||||| | ||</div>
    <div class="center">¡Gracias por tu compra!</div>
  </body></html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    await Sharing.shareAsync(uri);
  } catch (e: any) {
    Alert.alert('Error al generar ticket', e?.message ?? 'No fue posible generar el PDF.');
  }
}
