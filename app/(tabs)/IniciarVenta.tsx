// IniciarVenta.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Modal,
  Alert, Image, RefreshControl, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import CambiosModal from '@/components/CambiosModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDraft, setDraft, clearDraft, type DraftSale } from '@/constants/draftSale';
import * as Random from 'expo-random'; // idempotencia

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));

/** Id único cliente → servidor (idempotencia) */
const newClientTxId = () => {
  const b = Random.getRandomBytes(8);
  return `${Date.now()}-${Array.from(b).map(n => n.toString(16).padStart(2,'0')).join('')}`;
};

export default function IniciarVenta() {
  const { cliente, resume } = useLocalSearchParams();
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

  // pagos
  const [esCredito, setEsCredito] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<string>('');
  const [pagoTransfer, setPagoTransfer] = useState<string>('');
  const [pagoTarjeta, setPagoTarjeta] = useState<string>('');

  // idempotencia / anti-doble tap
  const [isSaving, setIsSaving] = useState(false);
  const [clientTxId, setClientTxId] = useState<string>(newClientTxId());

  const inputBusquedaRef = useRef<TextInput>(null);
  const router = useRouter();

  // ======= Cargar inventario / promos =======
  const priceForClient = (p: any) => Number(p?.precio_cliente ?? p?.precio ?? 0);
  const priceOfInventoryItemForClient = (invItem: any) =>
    Number(invItem?.producto?.precio_cliente ?? invItem?.producto?.precio ?? 0);

  const fetchInventario = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      const clienteQS = clienteSeleccionado?.id ? `?cliente_id=${clienteSeleccionado.id}` : '';
      const [invRes, promoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/inventario${clienteQS}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/promociones${clienteQS}`, {
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

  useEffect(() => { fetchInventario(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventario();
  }, []);

  const getPrecioProducto = (prodId: number) => {
    const inv = productos.find((i) => i.producto?.id === prodId || i.producto_id === prodId);
    return priceOfInventoryItemForClient(inv);
  };

  // ======= Borrador: crear / reanudar =======
  useEffect(() => {
    (async () => {
      if (resume === '1') {
        const draft = await getDraft();
        if (draft) {
          setCarrito(draft.carrito || []);
          setObservaciones(draft.observaciones || '');
          setCambiosVenta(draft.cambiosVenta || []);
          if (draft.client_tx_id) setClientTxId(draft.client_tx_id);
          if (typeof draft.es_credito === 'boolean') setEsCredito(draft.es_credito);
          if (draft.pagos) {
            setPagoEfectivo(String(draft.pagos.efectivo ?? ''));
            setPagoTransfer(String(draft.pagos.transferencia ?? ''));
            setPagoTarjeta(String(draft.pagos.tarjeta ?? ''));
          }
          setModalVisible(true); // abrir modal al reanudar
          return;
        }
      }
      // crear borrador inicial
      const nuevo: DraftSale = {
        cliente: clienteSeleccionado,
        carrito: [],
        observaciones: '',
        cambiosVenta: [],
        startedAt: new Date().toISOString(),
        client_tx_id: clientTxId,
        es_credito: esCredito,
        pagos: { efectivo: '', transferencia: '', tarjeta: '' },
        total: 0,
      };
      await setDraft(nuevo);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar cada cambio significativo en el borrador
  useEffect(() => {
    (async () => {
      const draft: DraftSale = {
        cliente: clienteSeleccionado,
        carrito,
        observaciones,
        cambiosVenta,
        startedAt: new Date().toISOString(),
        client_tx_id: clientTxId,
        es_credito: esCredito,
        pagos: { efectivo: pagoEfectivo, transferencia: pagoTransfer, tarjeta: pagoTarjeta },
        total: subtotalProductos + subtotalPromos,
      };
      await setDraft(draft);
    })();
  }, [carrito, observaciones, cambiosVenta, esCredito, pagoEfectivo, pagoTransfer, pagoTarjeta, clientTxId]);

  // === Carrito: + / - / set cantidad directa ===
  const agregarProducto = (producto: any) => {
    if (producto.isPromo) {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.promocion_id === producto.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            promocion_id: producto.id,
            nombre_promocion: producto.nombre,
            cantidad: 1,
            precio_promocion: Number(producto.precio),
            productos: (producto.productos || []).map((sp: any) => ({
              ...sp,
              precio: Number(sp?.precio_cliente ?? sp?.precio ?? getPrecioProducto(sp.id) ?? 0),
              pivot: sp.pivot,
            })),
          },
        ];
      });
    } else {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.producto_id === producto.producto_id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            ...producto,
            cantidad: 1,
            producto: { ...producto.producto, precio: priceOfInventoryItemForClient(producto) },
          },
        ];
      });
    }
  };

  const quitarProducto = (producto: any) => {
    if (producto.isPromo) {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.promocion_id === producto.id);
        if (idx < 0) return prev;
        const copy = [...prev];
        if (copy[idx].cantidad <= 1) return copy.filter((_, i) => i !== idx);
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad - 1 };
        return copy;
      });
    } else {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.producto_id === producto.producto_id);
        if (idx < 0) return prev;
        const copy = [...prev];
        if (copy[idx].cantidad <= 1) return copy.filter((_, i) => i !== idx);
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad - 1 };
        return copy;
      });
    }
  };

  const setCantidadDirecta = (producto: any, value: string) => {
    const n = value.replace(/[^\d]/g, '');
    if (producto.isPromo) {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.promocion_id === producto.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: n === '' ? 0 : Number(n) };
          return copy;
        }
        if (n === '' || Number(n) <= 0) return prev;
        return [
          ...prev,
          {
            promocion_id: producto.id,
            nombre_promocion: producto.nombre,
            cantidad: Number(n),
            precio_promocion: Number(producto.precio),
            productos: (producto.productos || []).map((sp: any) => ({
              ...sp,
              precio: Number(sp?.precio_cliente ?? sp?.precio ?? getPrecioProducto(sp.id) ?? 0),
              pivot: sp.pivot,
            })),
          },
        ];
      });
    } else {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.producto_id === producto.producto_id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: n === '' ? 0 : Number(n) };
          return copy;
        }
        if (n === '' || Number(n) <= 0) return prev;
        return [
          ...prev,
          {
            ...producto,
            cantidad: Number(n),
            producto: { ...producto.producto, precio: priceOfInventoryItemForClient(producto) },
          },
        ];
      });
    }
  };

  // filtros
  const productosFiltrados = useMemo(
    () => productos.filter((i) => (i.producto?.nombre || '').toLowerCase().includes(busqueda.toLowerCase())),
    [productos, busqueda]
  );
  const promocionesFiltradas = useMemo(
    () => promociones.filter((i) => (i.nombre || '').toLowerCase().includes(busqueda.toLowerCase())),
    [promociones, busqueda]
  );

  const totalProductosCount = carrito.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);

  // totales
  const subtotalProductos = carrito
    .filter((p) => p.producto_id && p.producto)
    .reduce((acc, p) => acc + Number(p.cantidad) * Number(priceForClient(p.producto)), 0);

  const subtotalPromos = carrito
    .filter((p) => p.promocion_id)
    .reduce((acc, p) => acc + Number(p.cantidad) * Number(p.precio_promocion || 0), 0);

  const ahorroPromos = carrito
    .filter((p) => p.promocion_id)
    .reduce((acc, p) => {
      const precioNormalPack = (p.productos || []).reduce(
        (s: number, sp: any) => s + Number(sp.precio || 0) * Number(sp?.pivot?.cantidad || 1),
        0
      );
      return acc + Number(p.cantidad) * Math.max(precioNormalPack - Number(p.precio_promocion || 0), 0);
    }, 0);

  const totalVenta = subtotalProductos + subtotalPromos;

  // ======= Pagos =======
  const num = (s: string) => (s === '' ? 0 : Number(s));
  const pagosSuma = esCredito ? 0 : num(pagoEfectivo) + num(pagoTransfer) + num(pagoTarjeta);
  const restante = Math.max(0, Number((totalVenta - pagosSuma).toFixed(2)));
  const excedente = Math.max(0, Number((pagosSuma - totalVenta).toFixed(2)));
  const pagosValidos = esCredito ? true : excedente === 0;

  // ======= Guardar (POST) con idempotencia =======
  const confirmarVenta = async () => {
    if (isSaving) return; // evita doble tap
    setIsSaving(true);

    try {
      const token = await AsyncStorage.getItem('authToken');

      const productosPayload = carrito
        .filter((p) => p.producto_id && p.cantidad > 0)
        .map((p) => ({
          producto_id: p.producto_id,
          cantidad: Number(p.cantidad),
          precio_unitario: Number(priceForClient(p.producto)),
          lote: p.lote ?? null,
          fecha_caducidad: p.fecha_caducidad ?? null,
        }));

      const promocionesPayload = carrito
        .filter((p) => p.promocion_id && p.cantidad > 0)
        .map((p) => ({
          promocion_id: p.promocion_id,
          cantidad: Number(p.cantidad),
        }));

      const pagosPayload = esCredito
        ? []
        : [
            { metodo: 'efectivo', monto: Number(pagoEfectivo || 0) },
            { metodo: 'transferencia', monto: Number(pagoTransfer || 0) },
            { metodo: 'tarjeta',      monto: Number(pagoTarjeta || 0) },
          ].filter((x) => x.monto > 0);

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
          es_credito: esCredito,
          pagos: pagosPayload,
          saldo_pendiente: esCredito ? Number(totalVenta) : Number(restante),
          total: Number(totalVenta),

          // idempotencia
          client_tx_id: clientTxId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Toast.show({ type: 'error', text1: 'Error al guardar venta', text2: data?.message || 'Ocurrió un error' });
        return;
      }

      // Mostrar advertencia de crédito si llegó
      if (data?.warning) {
        Toast.show({ type: 'info', text1: 'Aviso de crédito', text2: String(data.warning) });
      }

      // ✅ OK
      await clearDraft();
      setClientTxId(newClientTxId()); // preparar siguiente venta
      Toast.show({ type: 'success', text1: '✅ Venta registrada', text2: `Folio #${data?.venta_id}` });
      fetchInventario();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Fallo de red', text2: String(e?.message || e) });
    } finally {
      setIsSaving(false);
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
        es_credito: String(esCredito),
        pagos: JSON.stringify(
          esCredito
            ? []
            : [
                { metodo: 'efectivo',      monto: num(pagoEfectivo) },
                { metodo: 'transferencia', monto: num(pagoTransfer) },
                { metodo: 'tarjeta',       monto: num(pagoTarjeta) },
              ].filter((x) => x.monto > 0)
        ),
        saldo_pendiente: String(esCredito ? totalVenta : restante),
      },
    });
    setCarrito([]);
    setCambiosVenta([]);
    setObservaciones('');
    setModalVisible(false);
    setClientTxId(newClientTxId()); // por si el usuario vuelve a esta vista de inmediato
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Venta para: {clienteSeleccionado?.nombre}</Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          ref={inputBusquedaRef}
          style={styles.input}
          placeholder="Buscar producto..."
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {busqueda !== '' && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={[...promocionesFiltradas.map((p) => ({ ...p, isPromo: true })), ...productosFiltrados]}
        keyExtractor={(item: any, index) => (item?.isPromo ? `promo-${item.id}` : `inv-${item?.producto_id ?? index}`)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.primario]} tintColor={Colors.light.primario} />
        }
        renderItem={({ item }: any) => {
          const cantidadActual = item.isPromo
            ? carrito.find((p) => p.promocion_id === item.id)?.cantidad || 0
            : carrito.find((p) => p.producto_id === item.producto_id)?.cantidad || 0;

          const CantidadEditor = (
            <View style={styles.qtyRow}>
              <TouchableOpacity onPress={() => quitarProducto(item)}>
                <Ionicons name="remove-circle-outline" size={26} color={Colors.light.primario} />
              </TouchableOpacity>

              <TextInput
                style={styles.qtyInput}
                keyboardType="number-pad"
                value={String(cantidadActual)}
                onChangeText={(v) => setCantidadDirecta(item, v)}
                onBlur={() => {
                  const val = Number(cantidadActual || 0);
                  if (isNaN(val) || val < 0) setCantidadDirecta(item, '0');
                }}
                maxLength={5}
              />

              <TouchableOpacity onPress={() => agregarProducto(item)}>
                <Ionicons name="add-circle-outline" size={26} color={Colors.light.primario} />
              </TouchableOpacity>
            </View>
          );

          if (item.isPromo) {
            return (
              <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 4 }]}>
                <Text style={[styles.nombre, { color: 'purple' }]}>🔥 Promoción: {item.nombre}</Text>
                {!!item.descripcion && <Text style={styles.small}>📋 {item.descripcion}</Text>}
                <Text style={styles.small}>💰 Precio Promo: {money(item.precio)}</Text>
                <Text style={styles.small}>🕒 {item.fecha_inicio} a {item.fecha_fin}</Text>
                <Text style={[styles.small, { marginTop: 6 }]}>Incluye:</Text>
                {item.productos?.map((prod: any, idx: number) => (
                  <Text key={idx} style={styles.small}>• {prod.nombre} (x{prod.pivot?.cantidad})</Text>
                ))}
                {CantidadEditor}
              </View>
            );
          }

          return (
            <View style={styles.card}>
              {item.producto?.imagen_url && (
                <Image source={{ uri: item.producto.imagen_url }} style={styles.imagen} resizeMode="contain" />
              )}
              <Text style={styles.nombre}><Ionicons name="pricetag-outline" /> {item.producto?.nombre}</Text>
              <Text style={styles.small}><Ionicons name="cube-outline" /> Cantidad: {item.cantidad}</Text>
              <Text style={styles.small}><Ionicons name="calendar-outline" /> Caduca: {item.fecha_caducidad || 'N/D'}</Text>
              <Text style={styles.small}><Ionicons name="cash-outline" /> Precio: {money(priceOfInventoryItemForClient(item))}</Text>
              {CantidadEditor}
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Abrir carrito y guardar borrador inmediato */}
      <TouchableOpacity
        style={styles.carritoBtn}
        onPress={async () => {
          setModalVisible(true);
          await setDraft({
            cliente: clienteSeleccionado,
            carrito,
            observaciones,
            cambiosVenta,
            startedAt: new Date().toISOString(),
            client_tx_id: clientTxId,
            es_credito: esCredito,
            pagos: { efectivo: pagoEfectivo, transferencia: pagoTransfer, tarjeta: pagoTarjeta },
            total: subtotalProductos + subtotalPromos,
          });
        }}
      >
        <Ionicons name="cart-outline" size={28} color="#fff" />
        {totalProductosCount > 0 && <Text style={styles.badge}>{totalProductosCount}</Text>}
      </TouchableOpacity>

      {/* Modal: Resumen + pagos */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.sheetTitle}>🧾 Resumen de venta</Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              {carrito.length === 0 ? (
                <Text>No hay productos aún.</Text>
              ) : (
                <View>
                  {carrito.map((p, index) => {
                    if (p.producto_id && p.producto) {
                      return (
                        <View key={`prod-${index}`} style={{ marginBottom: 6 }}>
                          <Text>
                            {p.producto.nombre} x {p.cantidad} = {money(p.cantidad * Number(priceForClient(p.producto)))}
                          </Text>
                          <Text style={styles.metaSmall}>
                            Lote: {p.lote || 'N/D'} · Caduca: {p.fecha_caducidad || 'N/D'}
                          </Text>
                        </View>
                      );
                    }
                    if (p.promocion_id) {
                      return (
                        <View key={`promo-${index}`} style={{ marginBottom: 6 }}>
                          <Text style={{ fontWeight: 'bold', color: Colors.light.primario }}>
                            🎁 {p.nombre_promocion || 'Promoción'} x {p.cantidad} = {money(p.cantidad * Number(p.precio_promocion))}
                          </Text>
                          {p.productos?.map((sp: any, j: number) => (
                            <Text key={j} style={styles.metaSmall}>
                              • {sp.nombre} (x{(sp?.pivot?.cantidad ?? 1) * p.cantidad})
                            </Text>
                          ))}
                        </View>
                      );
                    }
                    return null;
                  })}

                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontWeight: 'bold' }}>Subtotal productos: {money(subtotalProductos)}</Text>
                    <Text style={{ fontWeight: 'bold' }}>Subtotal promociones: {money(subtotalPromos)}</Text>
                    <Text style={{ fontWeight: 'bold', color: 'green' }}>Ahorro por promociones: -{money(ahorroPromos)}</Text>
                    <Text style={{ marginTop: 6, fontWeight: 'bold', color: Colors.light.primario }}>
                      Total: {money(totalVenta)}
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

              {/* MÉTODOS DE PAGO */}
              <View style={styles.payBox}>
                <View style={styles.payHeader}>
                  <Text style={styles.payTitle}>Método(s) de pago</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const next = !esCredito;
                      setEsCredito(next);
                      if (next) { setPagoEfectivo(''); setPagoTransfer(''); setPagoTarjeta(''); }
                    }}
                    style={[styles.creditChip, esCredito && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
                  >
                    <Ionicons name="time-outline" size={14} color={esCredito ? '#991B1B' : '#374151'} />
                    <Text style={[styles.creditChipText, esCredito && { color: '#991B1B' }]}>
                      {esCredito ? 'Venta a crédito' : 'Contado'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!esCredito && (
                  <>
                    <View style={styles.payRow}>
                      <Text style={styles.payLabel}>Efectivo</Text>
                      <TextInput
                        style={styles.payInput}
                        placeholder="$0.00"
                        keyboardType="decimal-pad"
                        value={pagoEfectivo}
                        onChangeText={setPagoEfectivo}
                      />
                    </View>
                    <View style={styles.payRow}>
                      <Text style={styles.payLabel}>Transferencia</Text>
                      <TextInput
                        style={styles.payInput}
                        placeholder="$0.00"
                        keyboardType="decimal-pad"
                        value={pagoTransfer}
                        onChangeText={setPagoTransfer}
                      />
                    </View>
                    <View style={styles.payRow}>
                      <Text style={styles.payLabel}>Tarjeta</Text>
                      <TextInput
                        style={styles.payInput}
                        placeholder="$0.00"
                        keyboardType="decimal-pad"
                        value={pagoTarjeta}
                        onChangeText={setPagoTarjeta}
                      />
                    </View>

                    <View style={styles.paySummary}>
                      <Text style={styles.paySumText}>Pagado: {money(pagosSuma)}</Text>
                      {restante > 0 ? (
                        <Text style={[styles.paySumText, { color: '#B45309' }]}>Restante: {money(restante)}</Text>
                      ) : (
                        <Text style={[styles.paySumText, { color: '#065F46' }]}>Listo para cerrar</Text>
                      )}
                      {excedente > 0 && (
                        <Text style={[styles.paySumText, { color: '#991B1B' }]}>Excedente: {money(excedente)}</Text>
                      )}
                    </View>
                  </>
                )}

                {esCredito && (
                  <Text style={{ color: '#6B7280', marginTop: 6 }}>
                    La venta se registrará a crédito. Saldo pendiente: {money(totalVenta)}
                  </Text>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmarBtn, (!pagosValidos || carrito.length === 0 || isSaving) && { opacity: 0.5 }]}
              onPress={() => {
                if (!pagosValidos) {
                  Alert.alert('Revisa los pagos', 'La suma de los pagos no puede exceder el total.');
                  return;
                }
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
              disabled={carrito.length === 0 || !pagosValidos || isSaving}
            >
              <Text style={styles.confirmarText}>{isSaving ? 'Guardando…' : 'Confirmar Venta'}</Text>
            </TouchableOpacity>

            {/* Descartar venta completa */}
            <TouchableOpacity
              style={[styles.cancelarBtn, { marginTop: 8 }]}
              onPress={() =>
                Alert.alert('Cancelar venta', '¿Deseas descartar esta venta?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Sí, descartar',
                    style: 'destructive',
                    onPress: async () => { await clearDraft(); router.back(); },
                  },
                ])
              }
            >
              <Text style={styles.cancelarText}>Descartar venta</Text>
            </TouchableOpacity>

            {/* Cerrar solo el modal */}
            <TouchableOpacity style={[styles.cancelarBtn, { marginTop: 8, backgroundColor: '#EEE' }]} onPress={() => setModalVisible(false)}>
              <Text style={[styles.cancelarText, { color: '#111827' }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  container: { flex: 1, padding: 16, backgroundColor: '#F3F4F6' },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center', color: Colors.light.primario },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F2F2F2', borderRadius: 12, paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10
  },
  input: { flex: 1, height: 44, color: '#111827' },

  card: {
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  nombre: { fontWeight: '700', marginBottom: 4, color: '#111827' },
  small: { color: '#374151', marginTop: 2 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  qtyInput: {
    minWidth: 52, paddingHorizontal: 10, height: 36, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, textAlign: 'center', color: '#111827'
  },

  imagen: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },

  carritoBtn: {
    position: 'absolute', bottom: 30, right: 20,
    backgroundColor: Colors.light.primario, borderRadius: 30, padding: 14, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: 'red', color: '#fff',
    fontSize: 12, borderRadius: 10, paddingHorizontal: 6,
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalContainer: { backgroundColor: 'white', padding: 16, borderTopRightRadius: 16, borderTopLeftRadius: 16, elevation: 6, maxHeight: '92%' },
  sheetTitle: { fontWeight: '800', fontSize: 18, marginBottom: 10, color: Colors.light.primario },
  metaSmall: { fontSize: 12, color: '#6B7280', marginLeft: 12 },

  confirmarBtn: { marginTop: 12, backgroundColor: Colors.light.primario, padding: 14, borderRadius: 10, alignItems: 'center' },
  confirmarText: { color: '#fff', fontWeight: '800' },

  cancelarBtn: { marginTop: 8, backgroundColor: '#E5E7EB', padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelarText: { color: '#111827', fontWeight: '700' },

  payBox: { marginTop: 16, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  payHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  payTitle: { fontWeight: '800', color: '#111827' },
  creditChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  creditChipText: { fontWeight: '700', color: '#111827', fontSize: 12 },

  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  payLabel: { color: '#111827' },
  payInput: {
    width: 120, height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 8, paddingHorizontal: 10, textAlign: 'right', color: '#111827'
  },
  paySummary: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paySumText: { fontWeight: '700' },
});
