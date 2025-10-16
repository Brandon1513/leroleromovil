// app/Ticket.tsx
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

// Ruta del logo en assets
const LOGO = require('../../assets/images/lerolero-logo.png');

export default function Ticket() {
  const router = useRouter(); // <-- para Terminar venta
  const { cliente, productos, total, observaciones, fecha, cambios } = useLocalSearchParams();

  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(true);

  // Cargar logo como base64 para que se vea en PDF/impresión
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(LOGO);
        await asset.downloadAsync();
        const b64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLogoBase64(`data:image/png;base64,${b64}`);
      } catch (e) {
        console.warn('No se pudo cargar el logo como base64:', e);
        setLogoBase64(null);
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
  const fechaFormateada = useMemo(
    () => new Date(fecha as string).toLocaleString(),
    [fecha]
  );

  // Subtotales y ahorro (coinciden con el flujo de venta)
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

  const generarHTML = () => {
    const resumenProductos = productosList
      .map((p: any) => {
        if (p.producto_id && p.producto) {
          // Producto normal
          return `
            <div style="margin-bottom:6px">
              <div><strong>${p.producto.nombre}</strong> x ${p.cantidad} = $${(p.cantidad * p.producto.precio).toFixed(2)}</div>
              <div style="font-size:10px; margin-left:12px; color:#444">
                Lote: ${p.lote || 'N/D'} - Caduca: ${p.fecha_caducidad || 'N/D'}
              </div>
            </div>
          `;
        }

        if (p.promocion_id) {
          // Promoción
          const sub = (p.productos || [])
            .map(
              (sp: any) => `
              <div style="font-size:10px; margin-left:12px;">
                • ${sp.nombre} (x${(sp?.pivot?.cantidad ?? 1) * p.cantidad})
              </div>
            `
            )
            .join('');
          return `
            <div style="margin-bottom:6px">
              <div><strong>🎁 ${p.nombre_promocion || 'Promoción'}</strong> x ${p.cantidad} = $${(
            p.cantidad * Number(p.precio_promocion)
          ).toFixed(2)}</div>
              ${sub}
            </div>
          `;
        }

        return '';
      })
      .join('');

    const htmlTotales = `
      <div class="section">
        <div><strong>Subtotal productos:</strong> $${subtotalProductos.toFixed(2)}</div>
        <div><strong>Subtotal promociones:</strong> $${subtotalPromos.toFixed(2)}</div>
        <div style="color:green;"><strong>Ahorro por promociones:</strong> -$${ahorroPromos.toFixed(2)}</div>
      </div>
    `;

    const resumenCambios =
      cambiosList.length > 0
        ? cambiosList
            .map(
              (c: any) => `
          <div>${c.producto} x ${c.cantidad} - Motivo: ${c.motivo}</div>
        `
            )
            .join('')
        : '';

    const css = `
      body { font-family: -apple-system, Roboto, Arial, 'Segoe UI', sans-serif; font-size: 12px; padding: 20px; color: #000; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .section { margin: 10px 0; }
      .line { border-top: 1px dashed #000; margin: 8px 0; }
      .wrap { max-width: 660px; margin: 0 auto; }
    `;

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>${css}</style>
        </head>
        <body>
          <div class="wrap">
            <div class="center">
              ${logoBase64 ? `<img src="${logoBase64}" width="120" />` : ''}
              <div class="bold">Netcore Systems</div>
              <div class="line"></div>
              <div class="bold">🧾 Ticket de Venta</div>
            </div>

            <div class="section">
              <div><strong>Cliente:</strong> ${clienteObj.nombre}</div>
              <div><strong>Fecha:</strong> ${fechaFormateada}</div>
              <div><strong>Observaciones:</strong> ${observaciones || 'Sin observaciones'}</div>
            </div>

            <div class="line"></div>

            <div class="section">
              <div><strong>Productos:</strong></div>
              ${resumenProductos}
            </div>

            ${
              cambiosList.length > 0
                ? `
              <div class="line"></div>
              <div class="section">
                <div><strong>Productos Devueltos:</strong></div>
                ${resumenCambios}
              </div>
            `
                : ''
            }

            <div class="line"></div>
            ${htmlTotales}
            <div class="line"></div>
            <div class="center bold">Total: $${totalCalculado.toFixed(2)}</div>
            <div class="center" style="margin-top:6px;">¡Gracias por tu compra!</div>
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
      await Print.printAsync({ html }); // abre el diálogo de impresión del sistema
    } catch (error: any) {
      Alert.alert('Error al imprimir', error?.message ?? 'Error desconocido');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🧾 Ticket de Venta</Text>

        <View style={styles.section}>
          <Text style={styles.label}>
            <Ionicons name="person" /> Cliente:
          </Text>
          <Text>{clienteObj.nombre}</Text>

          <Text style={styles.label}>
            <Ionicons name="calendar" /> Fecha:
          </Text>
          <Text>{fechaFormateada}</Text>

          <Text style={styles.label}>
            <Ionicons name="chatbox" /> Observaciones:
          </Text>
          <Text>{(observaciones as string) || 'Sin observaciones'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>🧂 Productos</Text>

          {productosList.map((p: any, i: number) => {
            if (p.producto_id && p.producto) {
              return (
                <View key={`prod-${i}`} style={{ marginBottom: 8 }}>
                  <Text>
                    {p.producto.nombre} x {p.cantidad} = ${' '}
                    {(p.cantidad * Number(p.producto.precio)).toFixed(2)}
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
                    🎁 {p.nombre_promocion || 'Promoción'} x {p.cantidad} = ${' '}
                    {(p.cantidad * Number(p.precio_promocion)).toFixed(2)}
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
          <Text>Subtotal productos: ${subtotalProductos.toFixed(2)}</Text>
          <Text>Subtotal promociones: ${subtotalPromos.toFixed(2)}</Text>
          <Text style={{ color: 'green' }}>
            Ahorro por promociones: -${ahorroPromos.toFixed(2)}
          </Text>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total: ${totalCalculado.toFixed(2)}</Text>
        </View>

        {/* Botones */}
        {loadingLogo ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator color={Colors.light.primario} />
          </View>
        ) : null}

        <TouchableOpacity style={styles.btnPrimary} onPress={imprimirTicket}>
          <Ionicons name="print-outline" size={20} color="#fff" />
          <Text style={styles.btnPrimaryText}>Imprimir ticket</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnGhost} onPress={crearYCompartirPDF}>
          <Ionicons name="document-outline" size={20} color={Colors.light.primario} />
          <Text style={styles.btnGhostText}>Compartir Ticket PDF</Text>
        </TouchableOpacity>

        {/* NUEVO: Terminar venta */}
        <TouchableOpacity
          style={styles.btnDone}
          onPress={() => router.replace('/(tabs)')}
        >
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

  // NUEVOS estilos
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
