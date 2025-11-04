import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

export default function HistorialVentas() {
  const router = useRouter();
  const { cliente, from } = useLocalSearchParams();
  const clienteSeleccionado = cliente ? JSON.parse(decodeURIComponent(cliente as string)) : null;

  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState('');
  const [mostrarInicioPicker, setMostrarInicioPicker] = useState(false);
  const [mostrarFinPicker, setMostrarFinPicker] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ✅ Logo en base64 para el PDF
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        // Ajusta la ruta del require si no usas alias @
        const logoModule = require('@/assets/images/lerolero-logo.png');
        const asset = Asset.fromModule(logoModule);

        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        const b64 = await FileSystem.readAsStringAsync(asset.localUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLogoBase64(`data:image/png;base64,${b64}`);
      } catch (e) {
        console.warn('No se pudo cargar el logo para el PDF:', e);
        setLogoBase64(null);
      }
    })();
  }, []);

  const fetchVentas = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(
        `${API_BASE_URL}/api/clientes/${clienteSeleccionado.id}/ventas`,
        { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setVentas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al obtener ventas', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // reset al cambiar de cliente
  useEffect(() => {
    setVentas([]);
    setFechaInicio(null);
    setFechaFin(null);
    setProductoSeleccionado('');
    setVentaSeleccionada(null);
    setModalVisible(false);
    setLoading(true);
    if (clienteSeleccionado?.id) fetchVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVentas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSeleccionado?.id]);

  const aplicarFiltros = useMemo(() => {
    const filtered = ventas.filter((v: any) => {
      const fecha = new Date(v.fecha);
      const coincideFecha =
        (!fechaInicio || fecha >= new Date(fechaInicio)) &&
        (!fechaFin || fecha <= new Date(fechaFin));
      const contieneProducto =
        productoSeleccionado === '' ||
        v.detalles?.some((d: any) =>
          (d.producto?.nombre || '')
            .toLowerCase()
            .includes(productoSeleccionado.toLowerCase())
        );
      return coincideFecha && contieneProducto;
    });
    return filtered.sort(
      (a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }, [ventas, fechaInicio, fechaFin, productoSeleccionado]);

  const resumen = useMemo(() => {
    const totalVentas = aplicarFiltros.length;
    const suma = aplicarFiltros.reduce((acc: number, v: any) => acc + Number(v.total || 0), 0);
    const avg = totalVentas ? suma / totalVentas : 0;
    return { totalVentas, suma, avg };
  }, [aplicarFiltros]);

  const limpiarFiltros = () => {
    setFechaInicio(null);
    setFechaFin(null);
    setProductoSeleccionado('');
  };

  const rangoRapido = (dias: number) => {
    const fin = new Date();
    const ini = new Date();
    ini.setDate(fin.getDate() - (dias - 1));
    setFechaInicio(ini);
    setFechaFin(fin);
  };

  const generarYCompartirPDF = async (venta: any) => {
    const fechaFormateada = new Date(venta.fecha).toLocaleString();
    const html = `
      <html><head><meta charset="utf-8" />
      <style>
        body { font-family: monospace; font-size: 12px; padding: 20px; color: #000; }
        .center { text-align: center; } .bold { font-weight: bold; }
        .section { margin-top: 10px; margin-bottom: 10px; }
        .line { border-top: 1px dashed #000; margin: 8px 0; }
        .barcode { margin-top: 20px; text-align: center; font-size: 24px; letter-spacing: 2px; }
      </style></head><body>
        <div class="center">
          ${logoBase64 ? `<img src="${logoBase64}" width="100" />` : ''}
          <div class="bold">Dulces Lero Lero</div>
          <div class="line"></div>
          <div class="bold">🧾 Ticket de Venta</div>
        </div>
        <div class="section">
          <div><strong>Cliente:</strong> ${venta.cliente?.nombre || ''}</div>
          <div><strong>Fecha:</strong> ${fechaFormateada}</div>
          <div><strong>Observaciones:</strong> ${venta.observaciones || 'Sin observaciones'}</div>
        </div>
        <div class="line"></div>
        <div class="section">
          <div><strong>Productos:</strong></div>
          ${
            (venta.detalles || [])
              .map((d: any) =>
                `<div>${d.producto?.nombre || ''} x ${d.cantidad} = ${money(Number(d.subtotal))}</div>
                 <div style="font-size:10px;color:#555">Lote: ${d.lote || 'N/D'} - Caduca: ${d.fecha_caducidad || 'N/D'}</div>`
              ).join('') || '<div>Sin productos</div>'
          }
        </div>
        <div class="line"></div>
        <div class="section">
          <div><strong>Productos Devueltos:</strong></div>
          ${
            venta.rechazos?.length
              ? venta.rechazos.map((r: any) =>
                  `<div>${r.producto?.nombre || ''} x ${r.cantidad} - Motivo: ${r.motivo}</div>
                   <div style="font-size:10px;color:#555">Lote: ${r.lote || 'N/D'} - Caduca: ${r.fecha_caducidad || 'N/D'}</div>`
                ).join('')
              : '<div>Sin devoluciones</div>'
          }
        </div>
        <div class="line"></div>
        <div class="center bold">Total: ${money(Number(venta.total))}</div>
        <div class="barcode">|| ||| ||||| | ||</div>
        <div class="center">¡Gracias por tu compra!</div>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri);
    } catch (error: any) {
      Alert.alert('Error al generar ticket', error.message);
    }
  };

  const goBack = useCallback(() => {
    if (from === 'clientes') {
      router.replace('/clientes');
    } else {
      router.back();
    }
    return true;
  }, [from, router]);

  const renderItem = ({ item }: any) => {
    const items =
      item?.detalles?.reduce((acc: number, d: any) => acc + Number(d?.cantidad || 0), 0) || 0;
    const devueltos =
      item?.rechazos?.reduce((acc: number, r: any) => acc + Number(r?.cantidad || 0), 0) || 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          setVentaSeleccionada(item);
          setModalVisible(true);
        }}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={18} color={Colors.light.primario} />
              <Text style={styles.cardDate}>{new Date(item.fecha).toLocaleString()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#aaa" />
          </View>

          <View style={styles.cardBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTotal}>{money(Number(item.total))}</Text>
              {item?.observaciones ? (
                <Text style={styles.obs} numberOfLines={1}>
                  <Ionicons name="chatbox-ellipses-outline" /> {item.observaciones}
                </Text>
              ) : null}
            </View>
            <View style={styles.badges}>
              <View style={styles.badge}>
                <Ionicons name="cube-outline" size={14} color="#1f2937" />
                <Text style={styles.badgeText}>{items} ítems</Text>
              </View>
              {devueltos > 0 && (
                <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="return-down-back-outline" size={14} color="#991B1B" />
                  <Text style={[styles.badgeText, { color: '#991B1B' }]}>{devueltos} devueltos</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
      </View>
    );
  }

  const Empty = () => (
    <View style={styles.empty}>
      <Ionicons name="file-tray-outline" size={48} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>Sin ventas</Text>
      <Text style={styles.emptyText}>No encontramos ventas con los filtros aplicados.</Text>
      <TouchableOpacity onPress={limpiarFiltros} style={styles.emptyBtn}>
        <Ionicons name="broom-outline" size={18} color="#fff" />
        <Text style={styles.emptyBtnText}>Limpiar filtros</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.light.primario} />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Historial de Ventas</Text>
          <Text style={styles.subtitulo}>{clienteSeleccionado?.nombre}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {/* Filtros */}
      <View style={styles.filtros}>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.chip} onPress={() => rangoRapido(1)}>
            <Text style={styles.chipText}>Hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => rangoRapido(7)}>
            <Text style={styles.chipText}>7 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={() => rangoRapido(30)}>
            <Text style={styles.chipText}>30 días</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chip, styles.chipClear]} onPress={limpiarFiltros}>
            <Ionicons name="broom-outline" size={14} color="#111827" />
            <Text style={[styles.chipText, { color: '#111827' }]}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.datesRow}>
          <TouchableOpacity style={styles.fechaBtn} onPress={() => setMostrarInicioPicker(true)}>
            <Ionicons name="calendar" size={16} color="#374151" />
            <Text style={styles.fechaText}>
              Desde: {fechaInicio ? new Date(fechaInicio).toLocaleDateString() : '...'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fechaBtn} onPress={() => setMostrarFinPicker(true)}>
            <Ionicons name="calendar" size={16} color="#374151" />
            <Text style={styles.fechaText}>
              Hasta: {fechaFin ? new Date(fechaFin).toLocaleDateString() : '...'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#6B7280" />
          <TextInput
            placeholder="Buscar producto..."
            style={styles.input}
            value={productoSeleccionado}
            onChangeText={setProductoSeleccionado}
          />
          {productoSeleccionado !== '' && (
            <TouchableOpacity onPress={() => setProductoSeleccionado('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Pickers */}
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

      {/* Lista */}
      <FlatList
        data={aplicarFiltros}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Empty />}
      />

      {/* Barra de resumen */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Ventas</Text>
          <Text style={styles.summaryValue}>{resumen.totalVentas}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{money(resumen.suma)}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Ticket prom.</Text>
          <Text style={styles.summaryValue}>{money(resumen.avg)}</Text>
        </View>
      </View>

      {/* Modal */}
      {modalVisible && ventaSeleccionada && (
        <Modal
          animationType="slide"
          transparent
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(false);
            setVentaSeleccionada(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.sheetTitle}>🧾 Detalle de Venta</Text>
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    setVentaSeleccionada(null);
                  }}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                <Text style={styles.meta}>
                  <Ionicons name="person" /> Cliente: {ventaSeleccionada.cliente?.nombre}
                </Text>
                <Text style={styles.meta}>
                  <Ionicons name="calendar" /> Fecha:{' '}
                  {new Date(ventaSeleccionada.fecha).toLocaleString()}
                </Text>
                <Text style={styles.meta}>
                  <Ionicons name="cash" /> Total: {money(Number(ventaSeleccionada.total))}
                </Text>
                {ventaSeleccionada.observaciones ? (
                  <Text style={styles.meta}>
                    <Ionicons name="chatbox-ellipses-outline" /> {ventaSeleccionada.observaciones}
                  </Text>
                ) : null}

                <Text style={styles.sectionTitle}>Productos</Text>
                {ventaSeleccionada.detalles?.map((d: any, i: number) => (
                  <View key={i} style={styles.detailRow}>
                    <Text style={styles.detailMain}>
                      {d.producto?.nombre} x {d.cantidad}
                    </Text>
                    <Text style={styles.detailSub}>{money(Number(d.subtotal))}</Text>
                    <Text style={styles.detailMeta}>
                      Lote: {d.lote || 'N/D'} · Caduca: {d.fecha_caducidad || 'N/D'}
                    </Text>
                  </View>
                ))}

                {ventaSeleccionada.rechazos?.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Productos Devueltos</Text>
                    {ventaSeleccionada.rechazos.map((r: any, i: number) => (
                      <View key={i} style={[styles.detailRow, { backgroundColor: '#FFF7F7' }]}>
                        <Text style={styles.detailMain}>
                          {r.producto?.nombre} x {r.cantidad}
                        </Text>
                        <Text style={[styles.detailSub, { color: '#991B1B' }]}>{r.motivo}</Text>
                        <Text style={styles.detailMeta}>
                          Lote: {r.lote || 'N/D'} · Caduca: {r.fecha_caducidad || 'N/D'}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#E5E7EB' }]}
                  onPress={() => {
                    setModalVisible(false);
                    setVentaSeleccionada(null);
                  }}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#111827" />
                  <Text style={[styles.actionText, { color: '#111827' }]}>Cerrar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.light.primario }]}
                  onPress={() => generarYCompartirPDF(ventaSeleccionada)}
                >
                  <Ionicons name="document-outline" size={18} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff' }]}>Compartir PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
    backgroundColor: '#fff', borderBottomColor: '#E5E7EB', borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingRight: 8 },
  backText: { color: Colors.light.primario, fontWeight: '600' },
  titulo: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitulo: { fontSize: 13, color: '#6B7280' },

  filtros: { padding: 16, gap: 10, backgroundColor: '#fff', borderBottomColor: '#E5E7EB', borderBottomWidth: 1 },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  chipText: { color: '#3730A3', fontWeight: '600', fontSize: 12 },
  chipClear: { backgroundColor: '#E5E7EB', flexDirection: 'row', gap: 6, alignItems: 'center' },

  datesRow: { flexDirection: 'row', gap: 10 },
  fechaBtn: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 8, alignItems: 'center' },
  fechaText: { color: '#111827' },

  searchRow: {
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 10,
    borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', gap: 8, alignItems: 'center'
  },
  input: { flex: 1, height: 40 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardDate: { marginLeft: 6, color: '#111827', fontWeight: '600' },
  cardBody: { marginTop: 8, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardTotal: { fontSize: 18, fontWeight: '800', color: Colors.light.primario },
  obs: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  badges: { alignItems: 'flex-end', gap: 6 },
  badge: { backgroundColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', gap: 6, alignItems: 'center' },
  badgeText: { color: '#1F2937', fontWeight: '600', fontSize: 12 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  summaryBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', borderTopColor: '#E5E7EB', borderTopWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  summaryItem: { alignItems: 'center' },
  summaryLabel: { color: '#6B7280', fontSize: 12 },
  summaryValue: { color: '#111827', fontWeight: '800' },
  separator: { width: 1, height: 28, backgroundColor: '#E5E7EB' },

  empty: { paddingTop: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  emptyText: { color: '#6B7280', marginBottom: 6 },
  emptyBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: Colors.light.primario, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalContainer: { backgroundColor: 'white', padding: 16, borderTopRightRadius: 16, borderTopLeftRadius: 16, elevation: 6, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sheetTitle: { fontWeight: '800', fontSize: 18 },
  meta: { marginTop: 4, color: '#111827' },
  sectionTitle: { marginTop: 12, fontWeight: '800', color: '#111827' },
  detailRow: { marginTop: 8, padding: 10, backgroundColor: '#F9FAFB', borderRadius: 10 },
  detailMain: { fontWeight: '700', color: '#111827' },
  detailSub: { color: Colors.light.primario, fontWeight: '700' },
  detailMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  actionText: { fontWeight: '700' },
});
