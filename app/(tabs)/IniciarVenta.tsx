import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import CambiosModal from '@/components/CambiosModal';

export default function IniciarVenta() {
  const { cliente } = useLocalSearchParams();
  const clienteSeleccionado = cliente ? JSON.parse(decodeURIComponent(cliente)) : null;

  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [cambiosVenta, setCambiosVenta] = useState([]);
  const [modalCambiosVisible, setModalCambiosVisible] = useState(false);

  const inputBusquedaRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const fetchInventario = async () => {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/inventario`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProductos(data);
    };
    fetchInventario();
  }, []);

  const agregarProducto = (producto) => {
    setCarrito((prev) => {
      const existente = prev.find((p) => p.id === producto.id);
      return existente
        ? prev.map((p) => (p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p))
        : [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const quitarProducto = (producto) => {
    setCarrito((prev) => {
      const existente = prev.find((p) => p.id === producto.id);
      return existente?.cantidad === 1
        ? prev.filter((p) => p.id !== producto.id)
        : prev.map((p) => (p.id === producto.id ? { ...p, cantidad: p.cantidad - 1 } : p));
    });
  };

  const productosFiltrados = productos.filter((item) =>
    item.producto.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalProductos = carrito.reduce((acc, p) => acc + p.cantidad, 0);
  const totalVenta = carrito.reduce((acc, p) => acc + p.cantidad * Number(p.producto.precio), 0);

  const confirmarVenta = async () => {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/api/venta`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        cliente_id: clienteSeleccionado?.id,
        observaciones,
        productos: carrito.map((p) => ({
          producto_id: p.producto.id,
          cantidad: p.cantidad,
          precio_unitario: p.producto.precio,
        })),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      Toast.show({ type: 'error', text1: 'Error al guardar venta', text2: data.message || 'Ocurrió un error' });
      throw new Error('Falló el registro de la venta');
    } else {
      Toast.show({ type: 'success', text1: '✅ Venta registrada', text2: `Folio #${data.venta_id}` });
    }
  };

  const finalizarVenta = () => {
    router.push({
      pathname: '/ticket',
      params: {
        cliente: JSON.stringify(clienteSeleccionado),
        productos: JSON.stringify(carrito),
        cambios: JSON.stringify(cambiosVenta), // ✅ Agregar esto
        total: totalVenta.toFixed(2),
        observaciones,
        fecha: new Date().toISOString(),
      },
    });
    setCarrito([]);
    setObservaciones('');
    setModalVisible(false);
  };

  const enviarCambios = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const cambiosFormateados = cambiosVenta
        .filter(c => c.cantidad > 0)
        .map(c => ({ producto_id: c.id, cantidad: c.cantidad, motivo: c.motivo }));

      if (cambiosFormateados.length > 0) {
        const response = await fetch(`${API_BASE_URL}/api/rechazos`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cambios: cambiosFormateados }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          Toast.show({ type: 'error', text1: 'Error al guardar cambios', text2: errorData.message || 'Ocurrió un error' });
        } else {
          Toast.show({ type: 'success', text1: '✅ Cambios registrados correctamente' });
        }
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error al enviar cambios', text2: error.message });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Venta para: {clienteSeleccionado?.nombre}</Text>
      <TextInput
        ref={inputBusquedaRef}
        style={styles.input}
        placeholder="Buscar producto..."
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <FlatList
        data={productosFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const enCarrito = carrito.find((p) => p.id === item.id)?.cantidad || 0;
          return (
            <View style={styles.card}>
              <Text style={styles.nombre}><Ionicons name="pricetag-outline" /> {item.producto.nombre}</Text>
              <Text><Ionicons name="cube-outline" /> Cantidad: {item.cantidad}</Text>
              <Text><Ionicons name="calendar-outline" /> Caduca: {item.producto.fecha_caducidad}</Text>
              <Text><Ionicons name="cash-outline" /> Precio: ${Number(item.producto.precio).toFixed(2)}</Text>
              <View style={styles.cantidadControl}>
                <TouchableOpacity onPress={() => quitarProducto(item)}>
                  <Ionicons name="remove-circle-outline" size={24} color={Colors.light.primario} />
                </TouchableOpacity>
                <Text style={styles.cantidad}>{enCarrito}</Text>
                <TouchableOpacity onPress={() => agregarProducto(item)}>
                  <Ionicons name="add-circle-outline" size={24} color={Colors.light.primario} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={styles.carritoBtn}
        onPress={() => setModalVisible(true)}>
        <Ionicons name="cart-outline" size={28} color="#fff" />
        {totalProductos > 0 && <Text style={styles.badge}>{totalProductos}</Text>}
      </TouchableOpacity>

      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.sheetTitle}>🧾 Resumen de venta</Text>
            {carrito.length === 0 ? (
              <Text>No hay productos aún.</Text>
            ) : (
              <>
                {carrito.map((p) => (
                  <Text key={p.id}>{p.producto.nombre} x {p.cantidad} = ${(p.cantidad * Number(p.producto.precio)).toFixed(2)}</Text>
                ))}
                <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Total: ${totalVenta.toFixed(2)}</Text>
                <TextInput
                  style={[styles.input, { marginTop: 16 }]}
                  placeholder="Observaciones (opcional)"
                  value={observaciones}
                  onChangeText={setObservaciones}
                />
              </>
            )}
            <TouchableOpacity
              style={styles.confirmarBtn}
              onPress={() => {
                Alert.alert('¿Recibiste producto en cambio?', 'El cliente devolvió productos por caducidad o no vendidos.', [
                  {
                    text: 'NO',
                    onPress: async () => {
                      await confirmarVenta();
                      finalizarVenta();
                    },
                    style: 'cancel',
                  },
                  {
                    text: 'SÍ',
                    onPress: () => {
                      setCambiosVenta([]);
                      setModalCambiosVisible(true);
                      setModalVisible(false);
                    },
                  },
                ]);
              }}
              disabled={carrito.length === 0}>
              <Text style={styles.confirmarText}>Confirmar Venta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelarBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CambiosModal
      visible={modalCambiosVisible}
      productos={productos}
      cambiosVenta={cambiosVenta}
      setCambiosVenta={setCambiosVenta}
      onConfirmar={async () => {
        await confirmarVenta();  // ← esta es la venta que no se estaba ejecutando
        finalizarVenta();
        setModalCambiosVisible(false);
      }}
      onClose={() => setModalCambiosVisible(false)}
      finalizarVenta={finalizarVenta}
    />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f2f2f2' },
  header: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderColor: '#ccc', borderWidth: 1, marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10 },
  nombre: { fontWeight: 'bold', marginBottom: 4 },
  cantidadControl: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  cantidad: { fontSize: 16, fontWeight: 'bold' },
  carritoBtn: { position: 'absolute', bottom: 30, right: 20, backgroundColor: Colors.light.primario, borderRadius: 30, padding: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: 'red', color: '#fff', fontSize: 12, borderRadius: 10, paddingHorizontal: 6 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalContainer: { backgroundColor: 'white', padding: 20, borderTopRightRadius: 16, borderTopLeftRadius: 16, elevation: 4 },
  sheetTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 12 },
  confirmarBtn: { marginTop: 16, backgroundColor: Colors.light.primario, padding: 14, borderRadius: 10, alignItems: 'center' },
  confirmarText: { color: '#fff', fontWeight: 'bold' },
  cancelarBtn: { marginTop: 8, backgroundColor: '#ccc', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelarText: { color: '#333', fontWeight: 'bold' },
});
