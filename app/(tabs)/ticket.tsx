// Ticket.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANS...'; // reemplaza por tu logo real

export default function Ticket() {
  const { cliente, productos, total, observaciones, fecha, cambios } = useLocalSearchParams();
  const cambiosList = cambios ? JSON.parse(cambios as string) : [];

  if (!cliente || !productos) {
    return <Text style={styles.error}>Error: No hay información de la venta.</Text>;
  }

  const clienteObj = JSON.parse(cliente as string);
  const productosList = JSON.parse(productos as string);
  const fechaFormateada = new Date(fecha as string).toLocaleString();

  // Subtotales y ahorro para vista previa y PDF
  const subtotalProductos = productosList
    .filter((p: any) => p.producto_id && p.producto)
    .reduce((acc: number, p: any) => acc + p.cantidad * Number(p.producto?.precio || 0), 0);

  const subtotalPromos = productosList
    .filter((p: any) => p.promocion_id)
    .reduce((acc: number, p: any) => acc + p.cantidad * Number(p.precio_promocion || 0), 0);

  const ahorroPromos = productosList
    .filter((p: any) => p.promocion_id)
    .reduce((acc: number, p: any) => {
      const precioNormalPack = (p.productos || []).reduce(
        (s: number, sp: any) => s + Number(sp.precio || 0) * Number(sp?.pivot?.cantidad || 1),
        0
      );
      return acc + p.cantidad * Math.max(precioNormalPack - Number(p.precio_promocion || 0), 0);
    }, 0);

  const totalCalculado = subtotalProductos + subtotalPromos; // coincide con lo que enviaste

  const generarHTML = () => {
    const resumenProductos = productosList.map((p: any) => {
      // Producto normal
      if (p.producto_id && p.producto) {
        return `
          <div style="margin-bottom:6px">
            <div><strong>${p.producto.nombre}</strong> x ${p.cantidad} = $${(p.cantidad * p.producto.precio).toFixed(2)}</div>
            <div style="font-size:10px; margin-left:12px; color:#444">
              Lote: ${p.lote || 'N/D'} - Caduca: ${p.fecha_caducidad || 'N/D'}
            </div>
          </div>
        `;
      }

      // Promoción
      if (p.promocion_id) {
        const sub = (p.productos || [])
          .map((sp: any) => `
            <div style="font-size:10px; margin-left:12px;">
              • ${sp.nombre} (x${(sp?.pivot?.cantidad ?? 1) * p.cantidad})
            </div>
          `)
          .join('');
        return `
          <div style="margin-bottom:6px">
            <div><strong>🎁 ${p.nombre_promocion || 'Promoción'}</strong> x ${p.cantidad} = $${(p.cantidad * Number(p.precio_promocion)).toFixed(2)}</div>
            ${sub}
          </div>
        `;
      }

      return '';
    }).join('');

    const htmlTotales = `
      <div class="section">
        <div><strong>Subtotal productos:</strong> $${subtotalProductos.toFixed(2)}</div>
        <div><strong>Subtotal promociones:</strong> $${subtotalPromos.toFixed(2)}</div>
        <div style="color:green;"><strong>Ahorro por promociones:</strong> -$${ahorroPromos.toFixed(2)}</div>
      </div>
    `;

    const resumenCambios = cambiosList.length > 0
      ? cambiosList.map((c: any) => `
        <div>${c.producto} x ${c.cantidad} - Motivo: ${c.motivo}</div>
      `).join('')
      : '';

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: monospace; font-size: 12px; padding: 20px; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .section { margin: 10px 0; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <img src="${LOGO_BASE64}" width="100" />
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

          ${cambiosList.length > 0 ? `
            <div class="line"></div>
            <div class="section">
              <div><strong>Productos Devueltos:</strong></div>
              ${resumenCambios}
            </div>
          ` : ''}

          <div class="line"></div>
          ${htmlTotales}
          <div class="line"></div>
          <div class="center bold">Total: $${totalCalculado.toFixed(2)}</div>
          <div class="center">¡Gracias por tu compra!</div>
        </body>
      </html>
    `;
  };

  const crearYCompartirPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generarHTML() });
      await Sharing.shareAsync(uri);
    } catch (error: any) {
      Alert.alert('Error al generar ticket', error?.message ?? 'Error desconocido');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🧾 Ticket de Venta</Text>

        <View style={styles.section}>
          <Text style={styles.label}><Ionicons name="person" /> Cliente:</Text>
          <Text>{clienteObj.nombre}</Text>

          <Text style={styles.label}><Ionicons name="calendar" /> Fecha:</Text>
          <Text>{fechaFormateada}</Text>

          <Text style={styles.label}><Ionicons name="chatbox" /> Observaciones:</Text>
          <Text>{(observaciones as string) || 'Sin observaciones'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>🧂 Productos</Text>

          {productosList.map((p: any, i: number) => {
            // Producto normal
            if (p.producto_id && p.producto) {
              return (
                <View key={`prod-${i}`} style={{ marginBottom: 8 }}>
                  <Text>
                    {p.producto.nombre} x {p.cantidad} = $
                    {(p.cantidad * Number(p.producto.precio)).toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#555', marginLeft: 12 }}>
                    Lote: {p.lote || 'N/D'} - Caduca: {p.fecha_caducidad || 'N/D'}
                  </Text>
                </View>
              );
            }

            // Promoción
            if (p.promocion_id) {
              return (
                <View key={`promo-${i}`} style={{ marginBottom: 10 }}>
                  <Text style={{ fontWeight: 'bold', color: Colors.light.primario }}>
                    🎁 {p.nombre_promocion || 'Promoción'} x {p.cantidad} = $
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
              <Text key={i}>{c.producto} x {c.cantidad} - Motivo: {c.motivo}</Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Totales</Text>
          <Text>Subtotal productos: ${subtotalProductos.toFixed(2)}</Text>
          <Text>Subtotal promociones: ${subtotalPromos.toFixed(2)}</Text>
          <Text style={{ color: 'green' }}>Ahorro por promociones: -${ahorroPromos.toFixed(2)}</Text>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total: ${totalCalculado.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={crearYCompartirPDF}>
          <Ionicons name="document-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Compartir Ticket PDF</Text>
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
  totalContainer: { alignItems: 'flex-end', marginBottom: 24 },
  totalText: { fontSize: 18, fontWeight: 'bold', color: Colors.light.primario },
  btn: { flexDirection: 'row', backgroundColor: Colors.light.primario, padding: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  error: { marginTop: 40, textAlign: 'center', color: 'red' },
});
