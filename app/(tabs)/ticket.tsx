// app/ticket.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOGO_LOCAL = require('../../assets/images/lerolero-logo.png');
const REMOTE_LOGO_URL = 'https://lerolerob.domcloud.dev/images/logo.png'; // ← tu logo en el back (HTTPS)

// ---------- Helpers ----------
const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));

const formatMX = (d: Date, withTime = true) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });

// Convierte un asset local a base64 (dataURL)
async function localAssetToBase64(mod: number) {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri;
  if (!uri) throw new Error('No se pudo resolver el asset local');
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = asset.type || 'png';
  return `data:image/${ext};base64,${b64}`;
}

// Descarga una URL remota y devuelve base64 (dataURL)
async function fetchRemoteLogoToBase64(url: string) {
  // Debe ser HTTPS en Android 9+ (tu URL lo es).
  const tmp = FileSystem.cacheDirectory + 'logo-remote';
  const dl = await FileSystem.downloadAsync(url, tmp);
  const b64 = await FileSystem.readAsStringAsync(dl.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // intenta deducir tipo por header; default png
  const ct = dl.headers['Content-Type'] || dl.headers['content-type'] || '';
  const ext =
    ct.includes('jpeg') || ct.includes('jpg') ? 'jpeg'
      : ct.includes('webp') ? 'webp'
      : 'png';
  return `data:image/${ext};base64,${b64}`;
}

// ---------- Componente ----------
export default function Ticket() {
  const router = useRouter();
  const {
    cliente,
    productos,
    total,
    observaciones,
    fecha,
    cambios,
    // pago/estado
    metodo_pago,
    forma_pago,
    es_credito,
    estado,
    total_pagado,
    saldo_pendiente,
    fecha_vencimiento,
    nota_pago,
  } = useLocalSearchParams();

  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // 1) Intenta remoto
        const remote = await fetchRemoteLogoToBase64(REMOTE_LOGO_URL);
        setLogoBase64(remote);
      } catch (e) {
        console.warn('Logo remoto falló, uso local. Detalle:', e);
        try {
          // 2) Fallback local
          const local = await localAssetToBase64(LOGO_LOCAL);
          setLogoBase64(local);
        } catch (e2) {
          console.warn('Logo local también falló, sin logo. Detalle:', e2);
          setLogoBase64(null);
        }
      } finally {
        setLoadingLogo(false);
      }
    })();
  }, []);

  if (!cliente || !productos) {
    return <Text style={styles.error}>Error: No hay información de la venta.</Text>;
  }

  const clienteObj = useMemo(() => JSON.parse(cliente as string), [cliente]);
  const productosList = useMemo(() => JSON.parse(productos as string), [productos]);
  const cambiosList = useMemo(() => (cambios ? JSON.parse(cambios as string) : []), [cambios]);

  const fechaFormateada = useMemo(() => {
    const d = new Date(String(fecha || new Date().toISOString()));
    return formatMX(d, true);
  }, [fecha]);

  // ---------- Totales ----------
  const subtotalProductos = useMemo(
    () =>
      productosList
        .filter((p: any) => p.producto_id && p.producto)
        .reduce((acc: number, p: any) => acc + p.cantidad * Number(p.producto?.precio || 0), 0),
    [productosList]
  );

  const subtotalPromos = useMemo(
    () =>
      productosList
        .filter((p: any) => p.promocion_id)
        .reduce((acc: number, p: any) => acc + p.cantidad * Number(p.precio_promocion || 0), 0),
    [productosList]
  );

  const ahorroPromos = useMemo(
    () =>
      productosList
        .filter((p: any) => p.promocion_id)
        .reduce((acc: number, p: any) => {
          const precioNormalPack = (p.productos || []).reduce(
            (s: number, sp: any) => s + Number(sp.precio || 0) * Number(sp?.pivot?.cantidad || 1),
            0
          );
          return acc + p.cantidad * Math.max(precioNormalPack - Number(p.precio_promocion || 0), 0);
        }, 0),
    [productosList]
  );

  const totalCalculado = useMemo(
    () => subtotalProductos + subtotalPromos,
    [subtotalProductos, subtotalPromos]
  );

  // ---------- Pago / Estado ----------
  const rawMetodo = String(metodo_pago || forma_pago || (es_credito ? 'crédito' : 'efectivo') || '')
    .toLowerCase();

  const metodoNice =
    rawMetodo === 'tarjeta'
      ? 'Tarjeta'
      : rawMetodo === 'transferencia'
      ? 'Transferencia'
      : rawMetodo === 'mixto'
      ? 'Pago mixto'
      : rawMetodo === 'crédito' || rawMetodo === 'credito'
      ? 'Crédito'
      : 'Efectivo';

  const estadoLower = String(estado || '').toLowerCase();
  const esCreditoFlag = String(es_credito || '').toLowerCase() === 'true' || es_credito === '1';

  const pagado = Number(total_pagado || 0);
  const saldo = Number(saldo_pendiente || 0);

  const venceStr = fecha_vencimiento ? formatMX(new Date(String(fecha_vencimiento)), false) : null;

  const isPagada = estadoLower === 'pagada' || saldo <= 0.01;
  const isCreditoActiva = estadoLower === 'credito' || (esCreditoFlag && saldo > 0.01);

  let estadoTxt = 'Pendiente';
  if (isPagada) {
    estadoTxt = esCreditoFlag ? 'Pagada — crédito liquidado' : 'Pagada';
  } else if (isCreditoActiva) {
    estadoTxt = `Crédito — resta ${money(saldo)}`;
  } else if (estadoLower === 'parcial') {
    estadoTxt = `Parcial — resta ${money(saldo)}`;
  }

  // ---------- HTML ----------
  const generarHTML = () => {
    const resumenProductos = productosList
      .map((p: any) => {
        if (p.producto_id && p.producto) {
          return `
            <div style="margin-bottom:6px">
              <div><strong>${p.producto.nombre}</strong> x ${p.cantidad} = ${money(
                p.cantidad * Number(p.producto.precio || 0)
              )}</div>
              <div style="font-size:10px; margin-left:12px; color:#444">
                Lote: ${p.lote || 'N/D'} - Caduca: ${p.fecha_caducidad || 'N/D'}
              </div>
            </div>
          `;
        }
        if (p.promocion_id) {
          const sub = (p.productos || [])
            .map(
              (sp: any) => `
                <div style="font-size:10px; margin-left:12px;">
                  • ${sp.nombre} (x${(sp?.pivot?.cantidad ?? 1) * p.cantidad})
                </div>`
            )
            .join('');
          return `
            <div style="margin-bottom:6px">
              <div><strong>🎁 ${p.nombre_promocion || 'Promoción'}</strong> x ${
            p.cantidad
          } = ${money(p.cantidad * Number(p.precio_promocion || 0))}</div>
              ${sub}
            </div>
          `;
        }
        return '';
      })
      .join('');

    const resumenCambios =
      cambiosList.length > 0
        ? cambiosList.map((c: any) => `<div>${c.producto} x ${c.cantidad} - Motivo: ${c.motivo}</div>`).join('')
        : '';

    const css = `
      @page { size: 72mm auto; margin: 0; }
      html, body {
        width: 72mm; margin: 0; padding: 0;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
        color: #000; font-family: -apple-system, Roboto, Arial, 'Segoe UI', sans-serif;
        line-height: 1.35; font-size: 14px;
      }
      .wrap { width: 72mm; padding: 8px 10px; box-sizing: border-box; }
      .center { text-align: center; } .bold { font-weight: bold; }
      .section { margin: 8px 0; } .line { border-top: 1px dashed #000; margin: 8px 0; }
      img.logo { display:block; margin: 0 auto 6px; max-width: 220px; width: 100%; }
    `;

    return `
      <html>
        <head><meta charset="utf-8" /><style>${css}</style></head>
        <body>
          <div class="wrap">
            <div class="center">
              ${logoBase64 ? `<img class="logo" src="${logoBase64}" width="120" />` : ''}
              <div class="bold">Dulces Lero Lero</div>
              <div class="line"></div>
              <div class="bold">🧾 Ticket de Venta</div>
            </div>

            <div class="section">
              <div><strong>Cliente:</strong> ${clienteObj.nombre}</div>
              <div><strong>Fecha:</strong> ${fechaFormateada}</div>
              <div><strong>Observaciones:</strong> ${observaciones || 'Sin observaciones'}</div>
            </div>

            <div class="section">
              <div><strong>Método de pago:</strong> ${metodoNice}</div>
              <div><strong>Estado:</strong> ${estadoTxt}${(venceStr && isCreditoActiva) ? ` (Vence: ${venceStr})` : ''}</div>
              ${(esCreditoFlag || estadoLower === 'parcial')
                ? `<div><strong>Pagado:</strong> ${money(pagado)} · <strong>Saldo:</strong> ${money(saldo)}</div>`
                : ''
              }
              ${nota_pago ? `<div><strong>Referencia:</strong> ${nota_pago}</div>` : ''}
            </div>

            <div class="line"></div>
            <div class="section"><div><strong>Productos:</strong></div>${resumenProductos}</div>

            ${cambiosList.length
              ? `<div class="line"></div>
                 <div class="section">
                   <div><strong>Productos Devueltos:</strong></div>
                   ${resumenCambios}
                 </div>`
              : ''}

            <div class="line"></div>
            <div class="section">
              <div><strong>Subtotal productos:</strong> ${money(subtotalProductos)}</div>
              <div><strong>Subtotal promociones:</strong> ${money(subtotalPromos)}</div>
              <div style="color:green;"><strong>Ahorro por promociones:</strong> -${money(ahorroPromos)}</div>
            </div>

            <div class="line"></div>
            <div class="center bold">Total: ${money(totalCalculado)}</div>
            <div class="center" style="margin-top:6px;">¡Gracias por tu compra!</div>
          </div>
        </body>
      </html>
    `;
  };

  // ---------- Acciones ----------
  const crearYCompartirPDF = async () => {
    try {
      const html = generarHTML();
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error: any) {
      Alert.alert('Error al generar ticket', error?.message ?? 'Error desconocido');
    }
  };

  const imprimirTicket = async () => {
    try {
      const html = generarHTML();
      await Print.printAsync({ html });
    } catch (error: any) {
      Alert.alert('Error al imprimir', error?.message ?? 'Error desconocido');
    }
  };

  // ---------- UI ----------
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🧾 Ticket de Venta</Text>

        <View style={styles.section}>
          <Text style={styles.label}><Ionicons name="person" /> Cliente:</Text>
          <Text>{clienteObj?.nombre ?? ''}</Text>

          <Text style={styles.label}><Ionicons name="calendar" /> Fecha:</Text>
          <Text>{fechaFormateada}</Text>

          <Text style={styles.label}><Ionicons name="chatbox" /> Observaciones:</Text>
          <Text>{(observaciones as string) || 'Sin observaciones'}</Text>

          {/* Pago / Estado */}
          <Text style={styles.label}><Ionicons name="card" /> Método de pago:</Text>
          <Text>{metodoNice}</Text>

          <Text style={styles.label}><Ionicons name="information-circle" /> Estado:</Text>
          <Text>
            {estadoTxt}{(venceStr && isCreditoActiva) ? ` · Vence: ${venceStr}` : ''}
          </Text>

          {(String(es_credito || '').toLowerCase() === 'true' || estadoLower === 'parcial') && (
            <>
              <Text style={styles.label}><Ionicons name="cash" /> Montos:</Text>
              <Text>Pagado: {money(Number(total_pagado || 0))} · Saldo: {money(Number(saldo_pendiente || 0))}</Text>
            </>
          )}

          {nota_pago ? (
            <>
              <Text style={styles.label}><Ionicons name="pricetag" /> Referencia:</Text>
              <Text>{String(nota_pago)}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>🧂 Productos</Text>
          {productosList.map((p: any, i: number) => {
            if (p.producto_id && p.producto) {
              return (
                <View key={`prod-${i}`} style={{ marginBottom: 8 }}>
                  <Text>
                    {p.producto.nombre} x {p.cantidad} = {money(p.cantidad * Number(p.producto.precio || 0))}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#555', marginLeft: 12 }}>
                    Lote: {p.lote || 'N/D'} - Caduca: {p.fecha_caducidad || 'N/D'}
                  </Text>
                </View>
              );
            }

            if (p.promocion_id) {
              return (
                <View key={`promo-${i}`} style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: 'bold', color: Colors.light.primario }}>
                    🎁 {p.nombre_promocion || 'Promoción'} x {p.cantidad} = {money(p.cantidad * Number(p.precio_promocion || 0))}
                  </Text>
                  {p.productos?.map((sp: any, j: number) => (
                    <Text key={j} style={{ fontSize: 12, marginLeft: 12 }}>
                      • {sp.nombre} (x{(sp?.pivot?.cantidad ?? 1) * p.cantidad})
                    </Text>
                  ))}
                </View>
              );
            }

            return null;
          })}
        </View>

        {cambiosList.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>♻️ Productos Devueltos</Text>
            {cambiosList.map((c: any, i: number) => (
              <Text key={i}>
                {c.producto} x {c.cantidad} - Motivo: {c.motivo}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Totales</Text>
          <Text>Subtotal productos: {money(subtotalProductos)}</Text>
          <Text>Subtotal promociones: {money(subtotalPromos)}</Text>
          <Text style={{ color: 'green' }}>
            Ahorro por promociones: -{money(ahorroPromos)}
          </Text>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total: {money(totalCalculado)}</Text>
        </View>

        {loadingLogo ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator color={Colors.light.primario} />
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btnPrimary, loadingLogo && { opacity: 0.5 }]}
          disabled={loadingLogo}
          onPress={imprimirTicket}
        >
          <Ionicons name="print-outline" size={20} color="#fff" />
          <Text style={styles.btnPrimaryText}>{loadingLogo ? 'Cargando logo…' : 'Imprimir ticket'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnGhost, loadingLogo && { opacity: 0.5 }]}
          disabled={loadingLogo}
          onPress={crearYCompartirPDF}
        >
          <Ionicons name="document-outline" size={20} color={Colors.light.primario} />
          <Text style={styles.btnGhostText}>{loadingLogo ? 'Preparando PDF…' : 'Compartir Ticket PDF'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnDone} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="checkmark-done-outline" size={20} color="#fff" />
          <Text style={styles.btnDoneText}>Terminar venta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f2f2f2' },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.primario,
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  label: { fontWeight: 'bold', marginTop: 8, marginBottom: 2 },
  totalContainer: { alignItems: 'flex-end', marginBottom: 16 },
  totalText: { fontSize: 18, fontWeight: 'bold', color: Colors.light.primario },

  btnPrimary: {
    flexDirection: 'row',
    backgroundColor: Colors.light.primario,
    padding: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  btnPrimaryText: { color: '#fff', fontWeight: 'bold' },

  btnGhost: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.light.primario,
    padding: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  btnGhostText: { color: Colors.light.primario, fontWeight: 'bold' },

  btnDone: {
    flexDirection: 'row',
    backgroundColor: '#34a853',
    padding: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  btnDoneText: { color: '#fff', fontWeight: 'bold' },

  error: { marginTop: 40, textAlign: 'center', color: 'red' },
});
