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
  RefreshControl, // <-- agregado aquí
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';

export default function HistorialVentas() {
  const { cliente } = useLocalSearchParams();
  const clienteSeleccionado = cliente ? JSON.parse(decodeURIComponent(cliente)) : null;

  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // <-- agregado
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
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      setVentas(data);
    } catch (error) {
      console.error('Error al obtener ventas', error);
    } finally {
      setLoading(false);
      setRefreshing(false); // <-- detenemos refreshing
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
    return ventas.filter(v => {
      const fecha = new Date(v.fecha);
      const coincideFecha =
        (!fechaInicio || fecha >= new Date(fechaInicio)) &&
        (!fechaFin || fecha <= new Date(fechaFin));

      const contieneProducto = productoSeleccionado === '' || v.detalles.some(detalle =>
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

  if (loading && !refreshing) { // <-- importante: si solo carga normal
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>🧾 Historial de Ventas</Text>
      <Text style={styles.subtitulo}>Cliente: {clienteSeleccionado?.nombre}</Text>

      {/* Filtros */}
      <View style={styles.filtros}>
        <TouchableOpacity
          style={styles.fechaBtn}
          onPress={() => setMostrarInicioPicker(true)}
        >
          <Text>
            📅 Desde: {fechaInicio ? new Date(fechaInicio).toLocaleDateString() : '...' }
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fechaBtn}
          onPress={() => setMostrarFinPicker(true)}
        >
          <Text>
            📅 Hasta: {fechaFin ? new Date(fechaFin).toLocaleDateString() : '...'}
          </Text>
        </TouchableOpacity>

        <TextInput
          placeholder="🔍 Producto"
          style={styles.input}
          value={productoSeleccionado}
          onChangeText={setProductoSeleccionado}
        />

        <TouchableOpacity
          style={styles.botonLimpiar}
          onPress={limpiarFiltros}
        >
          <Text style={styles.textoBotonLimpiar}>🧹 Limpiar Filtros</Text>
        </TouchableOpacity>
      </View>

      {/* DatePickers */}
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

      {/* FlatList de ventas */}
      <FlatList
        data={aplicarFiltros()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> // <-- Aquí también
        }
      />

      {/* Modal para detalle de venta */}
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
                <Text key={i}>
                  {d.producto?.nombre} x {d.cantidad} = ${Number(d.subtotal).toFixed(2)}
                </Text>
              ))}

              <TouchableOpacity style={styles.cerrarBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cerrarText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 16,
    color: Colors.light.primario,
  },
  subtitulo: {
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    color: '#555'
  },
  filtros: {
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  fechaBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  botonLimpiar: {
    marginTop: 4,
    backgroundColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  textoBotonLimpiar: {
    color: '#333',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2
  },
  fecha: {
    fontWeight: 'bold',
    marginBottom: 6,
  },
  total: {
    marginBottom: 6,
    color: '#333'
  },
  detalle: {
    fontSize: 14,
    color: '#666'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    elevation: 4,
  },
  sheetTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 12,
  },
  cerrarBtn: {
    marginTop: 16,
    backgroundColor: '#ccc',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cerrarText: {
    color: '#333',
    fontWeight: 'bold',
  }
  
});
