import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOGO_BASE64 = 'data:image/png;base64,...'; // tu logo real en base64

export default function HistorialVentas() {
  const { cliente } = useLocalSearchParams();
  const clienteSeleccionado = cliente ? JSON.parse(decodeURIComponent(cliente)) : null;

  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState('');
  const [mostrarInicioPicker, setMostrarInicioPicker] = useState(false);
  const [mostrarFinPicker, setMostrarFinPicker] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchVentas = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/clientes/${clienteSeleccionado.id}/ventas`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setVentas(data);
    } catch (error) {
      console.error('Error al obtener ventas', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVentas();
  }, []);

  const aplicarFiltros = () => {
    return ventas.filter((v) => {
      const fecha = new Date(v.fecha);
      const coincideFecha =
        (!fechaInicio || fecha >= new Date(fechaInicio)) &&
        (!fechaFin || fecha <= new Date(fechaFin));

      const contieneProducto =
        productoSeleccionado === '' ||
        v.detalles.some((detalle) =>
          detalle.producto.nombre.toLowerCase().includes(productoSeleccionado.toLowerCase())
        );

      return coincideFecha && contieneProducto;
    });
  };

  const limpiarFiltros = () => {
    setFechaInicio(null);
    setFechaFin(null);
    setProductoSeleccionado('');
  };

  const generarYCompartirPDF = async (venta) => {
  const fechaFormateada = new Date(venta.fecha).toLocaleString();

  const html = `
    <html>
      <head>
        <style>
          body { font-family: monospace; font-size: 12px; padding: 20px; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .section { margin-top: 10px; margin-bottom: 10px; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .barcode { margin-top: 20px; text-align: center; font-size: 24px; letter-spacing: 2px; }
        </style>
      </head>
      <body>
        <div class="center">
          <img src="${LOGO_BASE64}" width="100" />
          <div class="bold">Netcore Systems</div>
          <div>C. Hornos 220</div>
          <div>San Juan, 45500</div>
          <div>San Pedro Tlaquepaque, Jal.</div>
          <div class="line"></div>
          <div class="bold">🧾 Ticket de Venta</div>
        </div>

        <div class="section">
          <div><strong>Cliente:</strong> ${venta.cliente?.nombre}</div>
          <div><strong>Fecha:</strong> ${fechaFormateada}</div>
          <div><strong>Observaciones:</strong> ${venta.observaciones || 'Sin observaciones'}</div>
        </div>

        <div class="line"></div>

        <div class="section">
          <div><strong>Productos:</strong></div>
          ${venta.detalles
            .map(
              (d) =>
                `<div>${d.producto?.nombre} x ${d.cantidad} = $${Number(d.subtotal).toFixed(2)}</div>
                 <div style="font-size: 10px; color: #555;">Lote: ${d.lote || 'N/D'} - Caduca: ${d.fecha_caducidad || 'N/D'}</div>`
            )
            .join('')}
        </div>

        <div class="line"></div>

        <div class="section">
          <div><strong>Productos Devueltos:</strong></div>
          ${
            venta.rechazos && venta.rechazos.length > 0
              ? venta.rechazos
                  .map(
                    (r) =>
                      `<div>${r.producto?.nombre} x ${r.cantidad} - Motivo: ${r.motivo}</div>
                       <div style="font-size: 10px; color: #555;">Lote: ${r.lote || 'N/D'} - Caduca: ${r.fecha_caducidad || 'N/D'}</div>`
                  )
                  .join('')
              : '<div>Sin devoluciones</div>'
          }
        </div>

        <div class="line"></div>
        <div class="center bold">Total: $${Number(venta.total).toFixed(2)}</div>
        <div class="barcode">|| ||| ||||| | ||</div>
        <div class="center">¡Gracias por tu compra!</div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    await Sharing.shareAsync(uri);
  } catch (error) {
    Alert.alert('Error al generar ticket', error.message);
  }
};


  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        setVentaSeleccionada(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.card}>
        <Text style={styles.fecha}>
          <Ionicons name="calendar-outline" size={16} color={Colors.light.primario} /> {item.fecha}
        </Text>
        <Text style={styles.total}>
          <Ionicons name="cash-outline" size={16} color={Colors.light.primario} /> Total: ${Number(item.total).toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>🧾 Historial de Ventas</Text>
      <Text style={styles.subtitulo}>Cliente: {clienteSeleccionado?.nombre}</Text>

      <View style={styles.filtros}>
        <TouchableOpacity style={styles.fechaBtn} onPress={() => setMostrarInicioPicker(true)}>
          <Text>📅 Desde: {fechaInicio ? new Date(fechaInicio).toLocaleDateString() : '...'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fechaBtn} onPress={() => setMostrarFinPicker(true)}>
          <Text>📅 Hasta: {fechaFin ? new Date(fechaFin).toLocaleDateString() : '...'}</Text>
        </TouchableOpacity>

        <TextInput
          placeholder="🔍 Producto"
          style={styles.input}
          value={productoSeleccionado}
          onChangeText={setProductoSeleccionado}
        />

        <TouchableOpacity style={styles.botonLimpiar} onPress={limpiarFiltros}>
          <Text style={styles.textoBotonLimpiar}>🧹 Limpiar Filtros</Text>
        </TouchableOpacity>
      </View>

      {mostrarInicioPicker && (
        <DateTimePicker
          value={fechaInicio ? new Date(fechaInicio) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setMostrarInicioPicker(false);
            if (date) setFechaInicio(date);
          }}
        />
      )}
      {mostrarFinPicker && (
        <DateTimePicker
          value={fechaFin ? new Date(fechaFin) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setMostrarFinPicker(false);
            if (date) setFechaFin(date);
          }}
        />
      )}

      <FlatList
        data={aplicarFiltros()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {ventaSeleccionada && (
        <Modal
          animationType="slide"
          transparent
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.sheetTitle}>🧾 Detalle de Venta</Text>
              <Text><Ionicons name="person" /> Cliente: {ventaSeleccionada.cliente?.nombre}</Text>
              <Text><Ionicons name="calendar" /> Fecha: {ventaSeleccionada.fecha}</Text>
              <Text><Ionicons name="cash" /> Total: ${Number(ventaSeleccionada.total).toFixed(2)}</Text>
              {ventaSeleccionada.observaciones && (
                <Text><Ionicons name="chatbox-ellipses-outline" /> {ventaSeleccionada.observaciones}</Text>
              )}
              <Text style={{ marginTop: 10, fontWeight: 'bold' }}>Productos</Text>
              {ventaSeleccionada.detalles.map((d, i) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text>{d.producto?.nombre} x {d.cantidad} = ${Number(d.subtotal).toFixed(2)}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    Lote: {d.lote || 'N/D'} - Caduca: {d.fecha_caducidad || 'N/D'}
                  </Text>
                </View>
              ))}
              {/* Mostramos también productos devueltos, si existen */}
              {ventaSeleccionada.rechazos?.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontWeight: 'bold' }}>Productos Devueltos</Text>
                  {ventaSeleccionada.rechazos.map((r, i) => (
                    <View key={i} style={{ marginBottom: 4 }}>
                      <Text>{r.producto?.nombre} x {r.cantidad} - Motivo: {r.motivo}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>
                        Lote: {r.lote || 'N/D'} - Caduca: {r.fecha_caducidad || 'N/D'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.cerrarBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cerrarText}>Cerrar</Text>
              </TouchableOpacity>

              {/* ✅ Botón adicional para compartir el ticket */}
              <TouchableOpacity
                style={[styles.cerrarBtn, { backgroundColor: Colors.light.primario, marginTop: 8 }]}
                onPress={() => generarYCompartirPDF(ventaSeleccionada)}
              >
                <Ionicons name="document-outline" size={20} color="#fff" />
                <Text style={[styles.cerrarText, { color: '#fff' }]}>Compartir Ticket PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  titulo: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, paddingTop: 16, color: Colors.light.primario },
  subtitulo: { fontSize: 14, paddingHorizontal: 16, marginBottom: 10, color: '#555' },
  filtros: { paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ccc' },
  fechaBtn: { backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ccc' },
  botonLimpiar: { marginTop: 4, backgroundColor: '#ddd', padding: 10, borderRadius: 8, alignItems: 'center' },
  textoBotonLimpiar: { color: '#333', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  fecha: { fontWeight: 'bold', marginBottom: 6 },
  total: { marginBottom: 6, color: '#333' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalContainer: { backgroundColor: 'white', padding: 20, borderTopRightRadius: 16, borderTopLeftRadius: 16, elevation: 4 },
  sheetTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 12 },
  cerrarBtn: { marginTop: 16, backgroundColor: '#ccc', padding: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  cerrarText: { color: '#333', fontWeight: 'bold' },
});

