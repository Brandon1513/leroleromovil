import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';

type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta';

type PagoRow = {
  id: string;
  metodo: MetodoPago;
  monto: string;      // como texto para que el teclado no truene
  referencia?: string | null;
};

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n ?? 0);

const EPS = 0.5; // tolerancia por redondeo

export default function CobranzaCliente() {
  const router = useRouter();
  const { cliente } = useLocalSearchParams();
  const clienteSel = cliente ? JSON.parse(decodeURIComponent(cliente as string)) : null;

  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  // Modal de abono
  const [modalVisible, setModalVisible] = useState(false);
  const [ventaSel, setVentaSel] = useState<any | null>(null);
  const [rows, setRows] = useState<PagoRow[]>([
    { id: 'row-1', metodo: 'efectivo', monto: '', referencia: null }
  ]);

  const fetchVentasCredito = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      // Si ya tienes un endpoint específico para crédito, úsalo. Si no, recarga historial y filtra:
      // Aquí asumo un endpoint GET /api/clientes/{id}/ventas que regresa estado y saldo_pendiente
      const res = await fetch(`${API_BASE_URL}/api/clientes/${clienteSel.id}/ventas`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const onlyPending = (Array.isArray(data) ? data : [])
        .filter((v: any) => (v.saldo_pendiente ?? 0) > 0 || ['credito', 'parcial'].includes(String(v.estado || '').toLowerCase()))
        .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setVentas(onlyPending);
    } catch (e) {
      console.error('Error cargando ventas a crédito', e);
      setVentas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (clienteSel?.id) fetchVentasCredito();
  }, [clienteSel?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVentasCredito();
  }, []);

  const ventasFiltradas = useMemo(() => {
    if (!q) return ventas;
    const s = q.toLowerCase();
    return ventas.filter((v: any) =>
      (String(v.id).includes(s)) ||
      (v.fecha && String(v.fecha).toLowerCase().includes(s))
    );
  }, [ventas, q]);

  const totalRows = useMemo(
    () => rows.reduce((acc, r) => acc + (parseFloat(r.monto.replace(',', '.')) || 0), 0),
    [rows]
  );

  const openAbono = (venta: any) => {
    setVentaSel(venta);
    setRows([{ id: 'row-1', metodo: 'efectivo', monto: '', referencia: null }]);
    setModalVisible(true);
  };

  const addRow = () => {
    const id = `row-${Date.now()}`;
    setRows(prev => [...prev, { id, metodo: 'efectivo', monto: '', referencia: null }]);
  };

  const updateRow = (id: string, patch: Partial<PagoRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.id !== id)));
  };

  const submitAbono = async () => {
    if (!ventaSel) return;

    const saldo = Number(ventaSel.saldo_pendiente ?? (ventaSel.total - (ventaSel.total_pagado ?? 0)));
    const pagos = rows
      .map(r => ({
        metodo: r.metodo,
        monto: parseFloat(r.monto.replace(',', '.')) || 0,
        referencia: r.referencia || null
      }))
      .filter(p => p.monto > 0);

    if (pagos.length === 0) {
      Alert.alert('Abono inválido', 'Captura al menos un monto válido.');
      return;
    }

    const suma = pagos.reduce((a, p) => a + p.monto, 0);
    if (suma - saldo > EPS) {
      Alert.alert('Excede el saldo', `La suma de abonos (${money(suma)}) no puede exceder el saldo (${money(saldo)}).`);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/venta/${ventaSel.id}/pagos`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          metodo: pagos.length === 1 ? pagos[0].metodo : 'efectivo', // backend ignora si mandas arreglo por ahora
          monto: suma,
          referencia: pagos.length === 1 ? pagos[0].referencia : 'ABONO-MIXTO',
          // Si quieres registrar pagos uno a uno en el backend, cambia a un endpoint que reciba arreglo.
        })
      });

      const json = await res.json();
      if (!res.ok) {
        Toast.show({ type: 'error', position:'top', text1: 'Error al abonar', text2: json?.message || 'Revisa los datos' });
        return;
      }

      Toast.show({ type: 'success', position:'top', text1: 'Abono registrado', text2: `Venta #${ventaSel.id} ${json?.estado ? `(${json.estado})` : ''}` });
      setModalVisible(false);
      setVentaSel(null);
      fetchVentasCredito();
    } catch (e: any) {
      Toast.show({ type: 'error', position:'top', text1: 'Error de red', text2: e?.message || 'No se pudo conectar' });
    }
  };

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={18} color={Colors.light.primario} />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Cobranza</Text>
        <Text style={styles.subtitle}>{clienteSel?.nombre}</Text>
      </View>
      <View style={{ width: 48 }} />
    </View>
  );

  const Search = () => (
    <View style={styles.searchRow}>
      <Ionicons name="search" size={16} color="#6B7280" />
      <TextInput
        placeholder="Buscar por folio o fecha…"
        style={styles.input}
        value={q}
        onChangeText={setQ}
      />
      {q !== '' && (
        <TouchableOpacity onPress={() => setQ('')}>
          <Ionicons name="close-circle" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderItem = ({ item }: any) => {
    const saldo = Number(item.saldo_pendiente ?? (item.total - (item.total_pagado ?? 0)));
    const pagado = Number(item.total_pagado ?? (item.total - saldo));
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="receipt-outline" size={18} color={Colors.light.primario} />
            <Text style={styles.cardTitle}>Folio #{item.id}</Text>
          </View>
          <Text style={styles.badgeEstado}>
            {String(item.estado || (saldo > 0 ? 'credito' : 'pagada')).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.rowText}><Ionicons name="calendar-outline" /> {new Date(item.fecha).toLocaleString()}</Text>
          <Text style={styles.rowText}><Ionicons name="cash-outline" /> Total: {money(Number(item.total))}</Text>
          <Text style={styles.rowText}><Ionicons name="wallet-outline" /> Pagado: {money(pagado)}</Text>
          <Text style={[styles.rowText, { fontWeight: '800', color: saldo > 0 ? '#991B1B' : '#111827' }]}>
            <Ionicons name="alert-circle-outline" /> Saldo: {money(saldo)}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => openAbono(item)}>
            <Ionicons name="add-circle-outline" size={18} color="#111827" />
            <Text style={styles.secondaryBtnText}>Abonar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <View style={styles.filters}>
        <Search />
      </View>

      <FlatList
        data={ventasFiltradas}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.primario]} tintColor={Colors.light.primario} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Sin adeudos</Text>
              <Text style={styles.emptyText}>Este cliente no tiene ventas con saldo pendiente.</Text>
            </View>
          ) : null
        }
      />

      {/* Modal de Abono */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.sheetTitle}>Registrar abono</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.meta}>
                <Ionicons name="receipt-outline" /> Venta #{ventaSel?.id}{'  '}
                <Ionicons name="cash-outline" /> Saldo: {money(Number(ventaSel?.saldo_pendiente ?? 0))}
              </Text>

              <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
                {rows.map((r, idx) => (
                  <View key={r.id} style={styles.rowPago}>
                    <View style={styles.rowPagoTop}>
                      {/* Selector simple de método (chips) */}
                      <View style={styles.metodos}>
                        {(['efectivo','transferencia','tarjeta'] as MetodoPago[]).map(m => {
                          const active = r.metodo === m;
                          return (
                            <TouchableOpacity
                              key={m}
                              style={[styles.chip, active ? styles.chipActive : null]}
                              onPress={() => updateRow(r.id, { metodo: m })}
                            >
                              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                                {m}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {rows.length > 1 && (
                        <TouchableOpacity onPress={() => removeRow(r.id)}>
                          <Ionicons name="trash-outline" size={18} color="#991B1B" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.inputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Monto</Text>
                        <TextInput
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          value={r.monto}
                          onChangeText={(t) => updateRow(r.id, { monto: t })}
                          style={styles.textInput}
                        />
                      </View>

                      {r.metodo !== 'efectivo' && (
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Referencia</Text>
                          <TextInput
                            placeholder={r.metodo === 'transferencia' ? 'TRX-123' : 'Núm. autorización'}
                            value={r.referencia || ''}
                            onChangeText={(t) => updateRow(r.id, { referencia: t })}
                            style={styles.textInput}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addBtn} onPress={addRow}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.light.primario} />
                  <Text style={styles.addBtnText}>Agregar otro método</Text>
                </TouchableOpacity>

                <View style={styles.totales}>
                  <Text style={styles.totalText}>Total a abonar</Text>
                  <Text style={[styles.totalText, { color: Colors.light.primario }]}>{money(totalRows)}</Text>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submitAbono}>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.saveText}>Guardar abono</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast topOffset={60}  />
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
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280' },

  filters: { backgroundColor: '#fff', padding: 16, borderBottomColor: '#E5E7EB', borderBottomWidth: 1 },
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
  cardTitle: { marginLeft: 6, color: '#111827', fontWeight: '700' },
  badgeEstado: {
    backgroundColor: '#EEF2FF', color: '#3730A3', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, fontSize: 12, fontWeight: '700'
  },
  cardBody: { marginTop: 8, gap: 4 },
  rowText: { color: '#111827' },
  cardActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  secondaryBtn: { backgroundColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', flex: 1 },
  secondaryBtnText: { color: '#111827', fontWeight: '700' },

  empty: { paddingTop: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  emptyText: { color: '#6B7280' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalContainer: { backgroundColor: 'white', padding: 16, borderTopRightRadius: 16, borderTopLeftRadius: 16, elevation: 6, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sheetTitle: { fontWeight: '800', fontSize: 18 },
  meta: { marginTop: 4, color: '#111827', marginBottom: 10 },

  rowPago: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  rowPagoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metodos: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: '#E5E7EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  chipActive: { backgroundColor: '#111827' },
  chipText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#fff' },

  inputsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  textInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, height: 40 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  addBtnText: { color: Colors.light.primario, fontWeight: '700' },

  totales: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  totalText: { fontWeight: '800', fontSize: 16 },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: '#E5E7EB', borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#111827', fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: Colors.light.primario, borderRadius: 10, alignItems: 'center', paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
