// IniciarVenta.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import CambiosModal from '@/components/CambiosModal';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IniciarVenta() {
  const { cliente } = useLocalSearchParams();
  const clienteSeleccionado = cliente ? JSON.parse(decodeURIComponent(cliente as string)) : null;

  const [productos, setProductos] = useState<any[]>([]);
  const [promociones, setPromociones] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [carrito, setCarrito] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [cambiosVenta, setCambiosVenta] = useState<any[]>([]);
  const [modalCambiosVisible, setModalCambiosVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const inputBusquedaRef = useRef<TextInput>(null);
  const router = useRouter();

  const fetchInventario = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      const [invRes, promoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/inventario`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/promociones`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        }),
      ]);

      const invData = await invRes.json();
      const promoData = await promoRes.json();

      setProductos(Array.isArray(invData) ? invData : []);
      setPromociones(Array.isArray(promoData?.promociones) ? promoData.promociones : []);
    } catch (error) {
      console.error('Error al obtener inventario/promociones:', error);
      setProductos([]);
      setPromociones([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventario();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventario();
  }, []);

  // Busca precio de un producto suelto en inventario (para calcular ahorro de promo)
  const getPrecioProducto = (prodId: number) => {
    const inv = productos.find(
      (i) => i.producto?.id === prodId || i.producto_id === prodId
    );
    return Number(inv?.producto?.precio ?? 0);
  };

  const agregarProducto = (producto: any) => {
    if (producto.isPromo) {
      setCarrito((prev) => {
        const existente = prev.find((p) => p.promocion_id === producto.id);
        return existente
          ? prev.map((p) =>
              p.promocion_id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
            )
          : [
              ...prev,
              {
                promocion_id: producto.id,
                nombre_promocion: producto.nombre,
                cantidad: 1,
                precio_promocion: Number(producto.precio),
                // Guardamos los productos de la promo con su precio para el ahorro
                productos: (producto.productos || []).map((sp: any) => ({
                  ...sp,
                  precio: Number(sp?.precio ?? getPrecioProducto(sp.id) ?? 0),
                  pivot: sp.pivot,
                })),
              },
            ];
      });
    } else {
      setCarrito((prev) => {
        const existente = prev.find((p) => p.producto_id === producto.producto_id);
        return existente
          ? prev.map((p) =>
              p.producto_id === producto.producto_id
                ? { ...p, cantidad: p.cantidad + 1 }
                : p
            )
          : [...prev, { ...producto, cantidad: 1 }];
      });
    }
  };

  const quitarProducto = (producto: any) => {
    if (producto.isPromo) {
      setCarrito((prev) => {
        const existente = prev.find((p) => p.promocion_id === producto.id);
        return existente?.cantidad === 1
          ? prev.filter((p) => p.promocion_id !== producto.id)
          : prev.map((p) =>
              p.promocion_id === producto.id ? { ...p, cantidad: p.cantidad - 1 } : p
            );
      });
    } else {
      setCarrito((prev) => {
        const existente = prev.find((p) => p.producto_id === producto.producto_id);
        return existente?.cantidad === 1
          ? prev.filter((p) => p.producto_id !== producto.producto_id)
          : prev.map((p) =>
              p.producto_id === producto.producto_id
                ? { ...p, cantidad: p.cantidad - 1 }
                : p
            );
      });
    }
  };

  const productosFiltrados = productos.filter((item) =>
    (item.producto?.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  );
  const promocionesFiltradas = promociones.filter((item) =>
    (item.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalProductosCount = carrito.reduce((acc, p) => acc + p.cantidad, 0);

  // Subtotales y ahorro
  const subtotalProductos = carrito
    .filter((p) => p.producto_id && p.producto)
    .reduce((acc, p) => acc + p.cantidad * Number(p.producto?.precio || 0), 0);

  const subtotalPromos = carrito
    .filter((p) => p.promocion_id)
    .reduce((acc, p) => acc + p.cantidad * Number(p.precio_promocion || 0), 0);

  const ahorroPromos = carrito
    .filter((p) => p.promocion_id)
    .reduce((acc, p) => {
      const precioNormalPack = (p.productos || []).reduce(
        (s: number, sp: any) => s + Number(sp.precio || 0) * Number(sp?.pivot?.cantidad || 1),
        0
      );
      return acc + p.cantidad * Math.max(precioNormalPack - Number(p.precio_promocion || 0), 0);
    }, 0);

  const totalVenta = subtotalProductos + subtotalPromos;

  const confirmarVenta = async () => {
    const token = await AsyncStorage.getItem('authToken');

    const productosPayload = carrito
      .filter((p) => p.producto_id)
      .map((p) => ({
        producto_id: p.producto_id,
        cantidad: p.cantidad,
        precio_unitario: p.producto.precio,
      }));

    const promocionesPayload = carrito
      .filter((p) => p.promocion_id)
      .map((p) => ({
        promocion_id: p.promocion_id,
        cantidad: p.cantidad,
      }));

    const response = await fetch(`${API_BASE_URL}/api/venta`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cliente_id: clienteSeleccionado?.id,
        observaciones,
        productos: productosPayload,
        promociones: promocionesPayload,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      Toast.show({
        type: 'error',
        text1: 'Error al guardar venta',
        text2: data?.message || 'Ocurrió un error',
      });
    } else {
      Toast.show({
        type: 'success',
        text1: '✅ Venta registrada',
        text2: `Folio #${data?.venta_id}`,
      });
      fetchInventario();
    }
  };

  const finalizarVenta = () => {
    router.push({
      pathname: '/ticket',
      params: {
        cliente: JSON.stringify(clienteSeleccionado),
        productos: JSON.stringify(carrito),
        cambios: JSON.stringify(cambiosVenta),
        total: totalVenta.toFixed(2),
        observaciones,
        fecha: new Date().toISOString(),
      },
    });
    setCarrito([]);
    setObservaciones('');
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Venta para: {clienteSeleccionado?.nombre}</Text>

      <TextInput
        ref={inputBusquedaRef}
        style={styles.input}
        placeholder="Buscar producto..."
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <FlatList
        data={[
          ...promocionesFiltradas.map((p) => ({ ...p, isPromo: true })),
          ...productosFiltrados,
        ]}
        keyExtractor={(item: any, index) =>
          item?.isPromo ? `promo-${item.id}` : `inv-${item?.producto_id ?? index}`
        }
        renderItem={({ item }: any) => {
          // Tarjeta de promoción
          if (item.isPromo) {
            const enCarrito = carrito.find((p) => p.promocion_id === item.id)?.cantidad || 0;

            return (
              <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 4 }]}>
                <Text style={[styles.nombre, { color: 'purple' }]}>🔥 Promoción: {item.nombre}</Text>
                <Text>📋 {item.descripcion}</Text>
                <Text>💰 Precio Promo: ${Number(item.precio).toFixed(2)}</Text>
                <Text>🕒 Vigencia: {item.fecha_inicio} a {item.fecha_fin}</Text>
                <Text>🧃 Incluye:</Text>
                {item.productos?.map((prod: any, idx: number) => (
                  <Text key={idx}>• {prod.nombre} (x{prod.pivot?.cantidad})</Text>
                ))}

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
          }

          // Tarjeta de producto individual
          const enCarrito = carrito.find((p) => p.producto_id === item.producto_id)?.cantidad || 0;
          return (
            <View style={styles.card}>
              {item.producto?.imagen_url && (
                <Image source={{ uri: item.producto.imagen_url }} style={styles.imagen} resizeMode="contain" />
              )}
              <Text style={styles.nombre}><Ionicons name="pricetag-outline" /> {item.producto?.nombre}</Text>
              <Text><Ionicons name="cube-outline" /> Cantidad: {item.cantidad}</Text>
              <Text><Ionicons name="calendar-outline" /> Caduca: {item.fecha_caducidad || 'N/D'}</Text>
              <Text><Ionicons name="cash-outline" /> Precio: ${Number(item.producto?.precio).toFixed(2)}</Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.primario]}
            tintColor={Colors.light.primario}
          />
        }
      />

      <TouchableOpacity style={styles.carritoBtn} onPress={() => setModalVisible(true)}>
        <Ionicons name="cart-outline" size={28} color="#fff" />
        {totalProductosCount > 0 && <Text style={styles.badge}>{totalProductosCount}</Text>}
      </TouchableOpacity>

      {/* Modal: Resumen de venta */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.sheetTitle}>🧾 Resumen de venta</Text>

            {carrito.length === 0 ? (
              <Text>No hay productos aún.</Text>
            ) : (
              <View>
                {carrito.map((p, index) => {
                  // Producto normal
                  if (p.producto_id && p.producto) {
                    return (
                      <View key={`prod-${index}`} style={{ marginBottom: 6 }}>
                        <Text>
                          {p.producto.nombre} x {p.cantidad} = $
                          {(p.cantidad * Number(p.producto.precio)).toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#666', marginLeft: 12 }}>
                          Lote: {p.lote || 'N/D'} · Caduca: {p.fecha_caducidad || 'N/D'}
                        </Text>
                      </View>
                    );
                  }

                  // Promoción
                  if (p.promocion_id) {
                    return (
                      <View key={`promo-${index}`} style={{ marginBottom: 6 }}>
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

                {/* Subtotales y ahorro */}
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: 'bold' }}>
                    Subtotal productos: ${subtotalProductos.toFixed(2)}
                  </Text>
                  <Text style={{ fontWeight: 'bold' }}>
                    Subtotal promociones: ${subtotalPromos.toFixed(2)}
                  </Text>
                  <Text style={{ fontWeight: 'bold', color: 'green' }}>
                    Ahorro por promociones: -${ahorroPromos.toFixed(2)}
                  </Text>
                  <Text style={{ marginTop: 6, fontWeight: 'bold', color: Colors.light.primario }}>
                    Total: ${totalVenta.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              style={[styles.input, { marginTop: 16 }]}
              placeholder="Observaciones (opcional)"
              value={observaciones}
              onChangeText={setObservaciones}
            />

            <TouchableOpacity
              style={styles.confirmarBtn}
              onPress={() => {
                Alert.alert(
                  '¿Recibiste producto en cambio?',
                  'El cliente devolvió productos por caducidad o no vendidos.',
                  [
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
                  ]
                );
              }}
              disabled={carrito.length === 0}
            >
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
          await confirmarVenta();
          finalizarVenta();
          setModalCambiosVisible(false);
        }}
        onClose={() => setModalCambiosVisible(false)}
        finalizarVenta={finalizarVenta}
      />
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f2f2f2' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: Colors.light.primario },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, borderColor: '#ccc', borderWidth: 1, marginBottom: 12 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 10 },
  nombre: { fontWeight: 'bold', marginBottom: 4 },
  cantidadControl: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  cantidad: { fontSize: 16, fontWeight: 'bold' },
  carritoBtn: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: Colors.light.primario,
    borderRadius: 30,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'red',
    color: '#fff',
    fontSize: 12,
    borderRadius: 10,
    paddingHorizontal: 6,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    elevation: 4,
  },
  sheetTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 12, color: Colors.light.primario },
  confirmarBtn: { marginTop: 16, backgroundColor: Colors.light.primario, padding: 14, borderRadius: 10, alignItems: 'center' },
  confirmarText: { color: '#fff', fontWeight: 'bold' },
  cancelarBtn: { marginTop: 8, backgroundColor: '#ccc', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelarText: { color: '#333', fontWeight: 'bold' },
  imagen: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },
});
