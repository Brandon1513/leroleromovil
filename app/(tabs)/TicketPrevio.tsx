import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/constants/Config';

const LOGO_LOCAL = require('../../assets/images/lerolero-logo.png'); // 👈 ajusta si tu ruta difiere
const REMOTE_LOGO_URL = 'https://lerolerob.domcloud.dev/images/logo.png';

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

async function localAssetToBase64(mod: number) {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri;
  if (!uri) throw new Error('No se pudo resolver el asset local');
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const ext = asset.type || 'png';
  return `data:image/${ext};base64,${b64}`;
}

async function fetchRemoteLogoToBase64(url: string) {
  const tmp = FileSystem.cacheDirectory + 'logo-remote';
  const dl = await FileSystem.downloadAsync(url, tmp);
  const b64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
  const ct = dl.headers['Content-Type'] || dl.headers['content-type'] || '';
  const ext =
    ct.includes('jpeg') || ct.includes('jpg') ? 'jpeg'
      : ct.includes('webp') ? 'webp'
      : 'png';
  return `data:image/${ext};base64,${b64}`;
}

type ResumenCategoria = {
  categoria: string;
  totalUnidades: number;
  totalMonto: number;
  productos: Array<{ nombre: string; cantidad: number; precio: number }>;
};

export default function TicketPrevio() {
  const router = useRouter();
  const { preventa_id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [preventa, setPreventa] = useState<any>(null);

  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const remote = await fetchRemoteLogoToBase64(REMOTE_LOGO_URL);
        setLogoBase64(remote);
      } catch {
        try {
          const local = await localAssetToBase64(LOGO_LOCAL);
          setLogoBase64(local);
        } catch {
          setLogoBase64(null);
        }
      } finally {
        setLoadingLogo(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const id = Number(preventa_id || 0);
        if (!id) {
          Alert.alert('Ticket previo', 'No llegó preventa_id');
          router.back();
          return;
        }

        const token = await AsyncStorage.getItem('authToken');

        const res = await fetch(`${API_BASE_URL}/api/preventas/${id}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });

        const json = await res.json();
        if (!res.ok) {
          Alert.alert('Error', json?.message || 'No se pudo cargar la preventa');
          router.back();
          return;
        }

        setPreventa(json);
      } catch (e: any) {
        Alert.alert('Error', String(e?.message || e));
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [preventa_id]);

  const clienteObj = preventa?.cliente || { nombre: '' };
  const productosList = preventa?.productos_ticket || [];
  const pagos = Array.isArray(preventa?.pagos) ? preventa.pagos : [];

  const fechaFormateada = useMemo(() => {
    const d = new Date(String(preventa?.created_at || new Date().toISOString()));
    return formatMX(d, true);
  }, [preventa?.created_at]);

  // Resumen por categorías (igual que tu ticket.tsx)
  const resumenPorCategoria = useMemo(() => {
    const mapa = new Map<string, ResumenCategoria>();

    (productosList || []).forEach((p: any) => {
      if (p.producto_id && p.producto) {
        const categoria = p.producto.categoria?.nombre || 'Sin categoría';
        const cantidad = Number(p.cantidad || 0);
        const precio = Number(p.producto.precio || 0);
        const monto = cantidad * precio;

        if (!mapa.has(categoria)) {
          mapa.set(categoria, { categoria, totalUnidades: 0, totalMonto: 0, productos: [] });
        }

        const cat = mapa.get(categoria)!;
        cat.totalUnidades += cantidad;
        cat.totalMonto += monto;
        cat.productos.push({ nombre: p.producto.nombre, cantidad, precio });
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [productosList]);

  const subtotalProductos = useMemo(
    () =>
      (productosList || [])
        .filter((p: any) => p.producto_id && p.producto)
        .reduce((acc: number, p: any) => acc + Number(p.cantidad || 0) * Number(p.producto?.precio || 0), 0),
    [productosList]
  );

  const subtotalPromos = useMemo(
    () =>
      (productosList || [])
        .filter((p: any) => p.promocion_id)
        .reduce((acc: number, p: any) => acc + Number(p.cantidad || 0) * Number(p.precio_promocion || 0), 0),
    [productosList]
  );

  const ahorroPromos = useMemo(
    () =>
      (productosList || [])
        .filter((p: any) => p.promocion_id)
        .reduce((acc: number, p: any) => {
          const precioNormalPack = (p.productos || []).reduce(
            (s: number, sp: any) => s + Number(sp.precio || 0) * Number(sp?.pivot?.cantidad || 1),
            0
          );
          return acc + Number(p.cantidad || 0) * Math.max(precioNormalPack - Number(p.precio_promocion || 0), 0);
        }, 0),
    [productosList]
  );

  const totalCalculado = subtotalProductos + subtotalPromos;

  const metodoPagoNice = useMemo(() => {
    // inferimos método por pagos (igual que tu lógica)
    const arr = pagos.filter((p: any) => Number(p?.monto || 0) > 0);
    if ((preventa?.es_credito || false) && arr.length === 0) return 'Crédito';
    if (arr.length === 0) return 'Efectivo';
    if (arr.length === 1) {
      const k = String(arr[0]?.metodo || '').toLowerCase();
      if (k === 'tarjeta') return 'Tarjeta';
      if (k === 'transferencia') return 'Transferencia';
      return 'Efectivo';
    }
    return 'Pago mixto';
  }, [pagos, preventa?.es_credito]);

  const estadoLower = String(preventa?.status || '').toLowerCase();
  const pagado = Number(preventa?.total_pagado || 0);
  const saldo = Number(preventa?.saldo_pendiente || 0);
  const esCreditoFlag = Boolean(preventa?.es_credito);

  const venceStr = preventa?.fecha_vencimiento
    ? formatMX(new Date(String(preventa.fecha_vencimiento)), false)
    : null;

  const isPagada = estadoLower === 'pagada' || saldo <= 0.01;
  const isCreditoActiva = estadoLower === 'credito' || (esCreditoFlag && saldo > 0.01);

  let estadoTxt = 'Pendiente';
  if (isPagada) {
    estadoTxt = esCreditoFlag ? 'Pagada — crédito liquidado' : 'Pagada';
  } else if (isCreditoActiva) {
    estadoTxt = `Crédito — resta ${money(saldo)}`;
  } else if (estadoLower === 'parcial') {
    estadoTxt = `Parcial — resta ${money(saldo)}`;
  } else if (estadoLower === 'impresa') {
    estadoTxt = 'Impresa (Preventa)';
  }

  const generarHTML = () => {
    const resumenProductos = (productosList || [])
      .map((p: any) => {
        if (p.producto_id && p.producto) {
          return `
            <div style="margin-bottom:6px">
              <div><strong>${p.producto.nombre}</strong> x ${p.cantidad} = ${money(
                Number(p.cantidad || 0) * Number(p.producto.precio || 0)
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
                  • ${sp.nombre} (x${(sp?.pivot?.cantidad ?? 1) * Number(p.cantidad || 0)})
                </div>`
            )
            .join('');

          return `
            <div style="margin-bottom:6px">
              <div><strong>🎁 ${p.nombre_promocion || 'Promoción'}</strong> x ${p.cantidad} = ${money(
                Number(p.cantidad || 0) * Number(p.precio_promocion || 0)
              )}</div>
              ${sub}
            </div>
          `;
        }

        return '';
      })
      .join('');

    const resumenCategoriasHTML = resumenPorCategoria
      .map((cat) => `
        <div style="margin-bottom:8px; padding:8px; background:#f8f9fa; border-radius:6px;">
          <div style="font-weight:bold; color:#2c3e50; margin-bottom:4px;">
            📦 ${cat.categoria}
          </div>
          <div style="font-size:12px; color:#555;">
            <strong>${cat.totalUnidades}</strong> unidades · ${money(cat.totalMonto)}
          </div>
        </div>
      `)
      .join('');

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
              <div class="bold">🧾 Ticket Previo (Preventa)</div>
            </div>

            <div class="section">
              <div><strong>Folio:</strong> ${preventa?.folio || `PV-${preventa?.id || ''}`}</div>
              <div><strong>Cliente:</strong> ${clienteObj?.nombre || ''}</div>
              <div><strong>Fecha:</strong> ${fechaFormateada}</div>
              <div><strong>Observaciones:</strong> ${preventa?.observaciones || 'Sin observaciones'}</div>
            </div>

            <div class="section">
              <div><strong>Método de pago:</strong> ${metodoPagoNice}</div>
              <div><strong>Estado:</strong> ${estadoTxt}${(venceStr && isCreditoActiva) ? ` (Vence: ${venceStr})` : ''}</div>
              ${(esCreditoFlag)
                ? `<div><strong>Pagado:</strong> ${money(pagado)} · <strong>Saldo:</strong> ${money(saldo)}</div>`
                : ''
              }
              ${preventa?.nota_pago ? `<div><strong>Referencia:</strong> ${String(preventa.nota_pago)}</div>` : ''}
            </div>

            <div class="line"></div>
            <div class="section"><div><strong>Productos:</strong></div>${resumenProductos}</div>

            <div class="line"></div>
            <div class="section">
              <div><strong>📊 Resumen por Categoría</strong></div>
              ${resumenCategoriasHTML}
            </div>

            <div class="line"></div>
            <div class="section">
              <div><strong>Subtotal productos:</strong> ${money(subtotalProductos)}</div>
              <div><strong>Subtotal promociones:</strong> ${money(subtotalPromos)}</div>
              <div style="color:green;"><strong>Ahorro por promociones:</strong> -${money(ahorroPromos)}</div>
            </div>

            <div class="line"></div>
            <div class="center bold">Total: ${money(totalCalculado)}</div>
            <div class="center" style="margin-top:6px;">(Preventa) ¡Gracias!</div>
          </div>
        </body>
      </html>
    `;
  };

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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
        <Text style={{ marginTop: 10 }}>Cargando ticket previo…</Text>
      </View>
    );
  }

  if (!preventa) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>No hay información de la preventa.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={{ color: Colors.light.primario, fontWeight: '800' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🧾 Ticket Previo (Preventa)</Text>

        <View style={styles.section}>
          <Text style={styles.label}><Ionicons name="barcode" /> Folio:</Text>
          <Text>{preventa?.folio || `PV-${preventa?.id || ''}`}</Text>

          <Text style={styles.label}><Ionicons name="person" /> Cliente:</Text>
          <Text>{clienteObj?.nombre ?? ''}</Text>

          <Text style={styles.label}><Ionicons name="calendar" /> Fecha:</Text>
          <Text>{fechaFormateada}</Text>

          <Text style={styles.label}><Ionicons name="chatbox" /> Observaciones:</Text>
          <Text>{preventa?.observaciones || 'Sin observaciones'}</Text>

          <Text style={styles.label}><Ionicons name="card" /> Método de pago:</Text>
          <Text>{metodoPagoNice}</Text>

          <Text style={styles.label}><Ionicons name="information-circle" /> Estado:</Text>
          <Text>
            {estadoTxt}{(venceStr && isCreditoActiva) ? ` · Vence: ${venceStr}` : ''}
          </Text>

          {esCreditoFlag && (
            <>
              <Text style={styles.label}><Ionicons name="cash" /> Montos:</Text>
              <Text>Pagado: {money(pagado)} · Saldo: {money(saldo)}</Text>
            </>
          )}

          {!!preventa?.nota_pago && (
            <>
              <Text style={styles.label}><Ionicons name="pricetag" /> Referencia:</Text>
              <Text>{String(preventa.nota_pago)}</Text>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>🧂 Productos</Text>

          {(productosList || []).length === 0 ? (
            <Text style={{ color: '#6B7280' }}>Sin productos.</Text>
          ) : (
            productosList.map((p: any, i: number) => {
              if (p.producto_id && p.producto) {
                return (
                  <View key={`prod-${i}`} style={{ marginBottom: 8 }}>
                    <Text>
                      {p.producto.nombre} x {p.cantidad} = {money(Number(p.cantidad || 0) * Number(p.producto.precio || 0))}
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
                      🎁 {p.nombre_promocion || 'Promoción'} x {p.cantidad} = {money(Number(p.cantidad || 0) * Number(p.precio_promocion || 0))}
                    </Text>
                    {p.productos?.map((sp: any, j: number) => (
                      <Text key={j} style={{ fontSize: 12, marginLeft: 12 }}>
                        • {sp.nombre} (x{(sp?.pivot?.cantidad ?? 1) * Number(p.cantidad || 0)})
                      </Text>
                    ))}
                  </View>
                );
              }

              return null;
            })
          )}
        </View>

        {resumenPorCategoria.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>📊 Resumen por Categoría</Text>
            {resumenPorCategoria.map((cat, idx) => (
              <View key={idx} style={styles.categoriaCard}>
                <View style={styles.categoriaHeader}>
                  <Text style={styles.categoriaNombre}>📦 {cat.categoria}</Text>
                </View>
                <View style={styles.categoriaInfo}>
                  <Text style={styles.categoriaUnidades}>
                    <Text style={{ fontWeight: '700' }}>{cat.totalUnidades}</Text> unidades
                  </Text>
                  <Text style={styles.categoriaMonto}>{money(cat.totalMonto)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Totales</Text>
          <Text>Subtotal productos: {money(subtotalProductos)}</Text>
          <Text>Subtotal promociones: {money(subtotalPromos)}</Text>
          <Text style={{ color: 'green' }}>Ahorro por promociones: -{money(ahorroPromos)}</Text>
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

        <TouchableOpacity style={styles.btnDone} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#fff" />
          <Text style={styles.btnDoneText}>Volver</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f2f2f2' },
  title: { fontSize: 24, fontWeight: 'bold', color: Colors.light.primario, marginBottom: 16, textAlign: 'center' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  label: { fontWeight: 'bold', marginTop: 8, marginBottom: 2 },

  categoriaCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primario,
  },
  categoriaHeader: { marginBottom: 6 },
  categoriaNombre: { fontSize: 16, fontWeight: '700', color: '#2C3E50' },
  categoriaInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoriaUnidades: { fontSize: 14, color: '#555' },
  categoriaMonto: { fontSize: 15, fontWeight: '600', color: Colors.light.primario },

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
});
