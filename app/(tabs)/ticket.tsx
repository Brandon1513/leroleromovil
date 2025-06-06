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
  const cambiosList = cambios ? JSON.parse(cambios) : [];

  if (!cliente || !productos) {
    return <Text style={styles.error}>Error: No hay información de la venta.</Text>;
  }

  const clienteObj = JSON.parse(cliente);
  const productosList = JSON.parse(productos);
  const fechaFormateada = new Date(fecha).toLocaleString();

  const generarHTML = () => {
    const resumenProductos = productosList.map(p => `
      <div>
        <strong>${p.producto.nombre}</strong> x ${p.cantidad} = $${(p.cantidad * p.producto.precio).toFixed(2)}
        <div style="font-size:10px; margin-left: 12px;">
          Lote: ${p.lote || 'N/D'} - Caduca: ${p.fecha_caducidad || 'N/D'}
        </div>
      </div>
    `).join('');

    const resumenCambios = cambiosList.length > 0
      ? cambiosList.map(c => `
        <div>${c.producto} x ${c.cantidad} - Motivo: ${c.motivo}</div>
      `).join('')
      : '';

    return `
      <html>
        <head>
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

          <div class="center bold">Total: $${parseFloat(total).toFixed(2)}</div>
          <div class="center">¡Gracias por tu compra!</div>
        </body>
      </html>
    `;
  };

  const crearYCompartirPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generarHTML() });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Error al generar ticket', error.message);
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
          <Text>{observaciones || 'Sin observaciones'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>🧂 Productos</Text>
          {productosList.map((p, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text>{p.producto.nombre} x {p.cantidad} = ${(
                p.cantidad * p.producto.precio
              ).toFixed(2)}</Text>
              <Text style={{ fontSize: 12, color: '#555', marginLeft: 12 }}>
                Lote: {p.lote || 'N/D'} - Caduca: {p.fecha_caducidad || 'N/D'}
              </Text>
            </View>
          ))}
        </View>

        {cambiosList.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>♻️ Productos Devueltos</Text>
            {cambiosList.map((c, i) => (
              <Text key={i}>{c.producto} x {c.cantidad} - Motivo: {c.motivo}</Text>
            ))}
          </View>
        )}

        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total: ${parseFloat(total).toFixed(2)}</Text>
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

