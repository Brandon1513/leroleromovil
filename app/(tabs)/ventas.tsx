import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Alert, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getDraft, hasDraft, clearDraft } from '@/constants/draftSale';

type Cliente = {
  id: number;
  nombre: string;
  telefono?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  nivel_precio?: { nombre?: string | null } | null;
  nivel_precio_nombre?: string | null;
  saldo_pendiente_total?: number;
  bloqueado?: boolean;
};

const RADIUS_METERS = 100;
const money = (n: number | undefined | null) => `$${(Number(n ?? 0)).toFixed(2)}`;

export default function Ventas() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const router = useRouter();

  // Helpers de navegación segura → IniciarVenta
  const encodeCliente = (c: Partial<Cliente> | null | undefined) => {
    if (!c || typeof c !== 'object') return '';
    const lite = { id: (c as any).id, nombre: (c as any).nombre };
    if (lite.id == null) return '';
    try { return encodeURIComponent(JSON.stringify(lite)); } catch { return ''; }
  };

  const goIniciar = (c: Cliente, extraParams: Record<string, string> = {}) => {
    const encoded = encodeCliente(c);
    if (!encoded) return; // evita /IniciarVenta?cliente=null
    router.push({
      pathname: '/IniciarVenta',
      params: { cliente: encoded, cliente_id: String(c.id), ...extraParams }, // 👈 aseguramos cliente_id
    });
  };

  const fetchClientes = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/clientes`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const raw = await res.json();
      const data: Cliente[] = (Array.isArray(raw) ? raw : []).map((c: any) => ({
        id: c?.id,
        nombre: c?.nombre ?? '',
        telefono: c?.telefono ?? '',
        latitud: c?.latitud ?? null,
        longitud: c?.longitud ?? null,
        nivel_precio: c?.nivel_precio ?? null,
        nivel_precio_nombre: c?.nivel_precio_nombre ?? c?.nivel_precio?.nombre ?? null,
        saldo_pendiente_total: Number(c?.saldo_pendiente_total ?? 0),
        bloqueado: Boolean(c?.bloqueado ?? (Number(c?.saldo_pendiente_total ?? 0) > 0)),
      }));
      setClientes(data);
    } catch (e: any) {
      console.error('Error al cargar clientes:', e?.message ?? e);
      setClientes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchClientes(); }, []);

  // 🔔 Avisar venta pendiente al entrar a la pantalla (solo si es válida)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const draft = await getDraft();
        if (!draft) return;

        const hasClient = !!draft?.cliente?.id;
        const hasItems  = Array.isArray(draft?.carrito) && draft.carrito.length > 0;
        const hasTotal  = Number(draft?.total ?? 0) > 0;

        if (!hasClient || (!hasItems && !hasTotal)) {
          await clearDraft(); // limpia restos vacíos
          return;
        }

        Alert.alert(
          'Venta pendiente',
          `Tienes una venta sin cerrar para "${draft?.cliente?.nombre ?? 'cliente'}".`,
          [
            {
              text: 'Reanudar',
              onPress: () => {
                const enc = encodeCliente(draft?.cliente as any);
                if (!enc) return;
                router.push({
                  pathname: '/IniciarVenta',
                  params: {
                    cliente: enc,
                    cliente_id: String(draft.cliente.id),
                    resume: '1',
                  },
                });
              },
            },
            { text: 'Descartar', style: 'destructive', onPress: clearDraft },
            { text: 'Cerrar', style: 'cancel' },
          ],
        );
      })();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClientes();
  }, []);

  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatMeters = (m: number) => (m < 1000 ? `${m.toFixed(0)} m` : `${(m/1000).toFixed(2)} km`);

  const checkUbicacion = async (cliente: Cliente) => {
    if (!cliente.latitud || !cliente.longitud) {
      Alert.alert('Ubicación no configurada', 'Este cliente no tiene coordenadas registradas.');
      return { ok: false, distancia: null as number | null };
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la ubicación para continuar.');
      return { ok: false, distancia: null as number | null };
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const d = calcularDistancia(pos.coords.latitude, pos.coords.longitude, cliente.latitud, cliente.longitud);
    return { ok: d <= RADIUS_METERS, distancia: d };
  };

  const confirmarInicioVenta = (cliente: Cliente) => {
    Alert.alert('Iniciar venta', `¿Deseas iniciar una venta para ${cliente.nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceptar',
        onPress: () => {
          const rid = Date.now().toString();
          goIniciar(cliente, { rid });
        },
      },
    ]);
  };

  const intentarIniciarVenta = async (cliente: Cliente) => {
    // 0) ⛔ si hay borrador, bloquear y ofrecer reanudar/descartar
    if (await hasDraft()) {
      const draft = await getDraft();
      const enc = encodeCliente(draft?.cliente as any);
      Alert.alert(
        'Venta pendiente',
        `Tienes una venta sin cerrar para "${draft?.cliente?.nombre ?? 'cliente'}".`,
        [
          { text: 'Reanudar', onPress: () => { if (enc) router.push({ pathname: '/IniciarVenta', params: { cliente: enc, cliente_id: String(draft?.cliente?.id ?? ''), resume: '1' } }); } },
          { text: 'Descartar', style: 'destructive', onPress: clearDraft },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return;
    }

    // 1) 🔒 bloqueo por saldo del cliente
    if (cliente.bloqueado) {
      Alert.alert(
        'Saldo pendiente',
        `${cliente.nombre} tiene ${money(cliente.saldo_pendiente_total)} sin pagar.\nRealiza la cobranza para continuar.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ir a Cobranza',
            onPress: () => {
              const enc = encodeCliente(cliente);
              if (!enc) return;
              router.push({ pathname: '/cobranza-cliente', params: { cliente: enc } });
            },
          },
        ]
      );
      return;
    }

    // 2) Validar ubicación y continuar
    try {
      setCheckingId(cliente.id);
      const { ok, distancia } = await checkUbicacion(cliente);
      if (!ok) {
        if (distancia !== null) {
          Alert.alert(
            'Ubicación incorrecta',
            `Debes estar cerca del cliente para iniciar la venta.\nTe encuentras a ${formatMeters(distancia)} (máx. ${RADIUS_METERS} m).`
          );
        }
        return;
      }
      confirmarInicioVenta(cliente);
    } finally {
      setCheckingId(null);
    }
  };

  const clientesFiltrados = useMemo(
    () => clientes.filter(c => (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase())),
    [clientes, busqueda]
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
      </SafeAreaView>
    );
  }

  const Header = () => (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Ionicons name="cart-outline" size={20} color={Colors.light.primario} />
        <Text style={styles.titulo}>Nueva Venta</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          style={styles.input}
          placeholder="Buscar cliente..."
          placeholderTextColor="#9CA3AF"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {busqueda !== '' && (
          <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: Cliente }) => {
    const tieneCoords = !!item.latitud && !!item.longitud;
    const blocked = Boolean(item.bloqueado);
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => intentarIniciarVenta(item)} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="person-circle-outline" size={22} color={Colors.light.primario} />
            <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, blocked && styles.actionBtnWarn]}
            onPress={(e) => { e.stopPropagation(); intentarIniciarVenta(item); }}
            disabled={checkingId === item.id}
          >
            {checkingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : blocked ? (
              <>
                <Ionicons name="cash-outline" size={16} color="#fff" />
                <Text style={styles.actionText}>Cobranza</Text>
              </>
            ) : (
              <>
                <Ionicons name="play-circle-outline" size={16} color="#fff" />
                <Text style={styles.actionText}>Iniciar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.rows}>
          <View style={styles.row}>
            <Ionicons name="call-outline" size={16} color="#6B7280" />
            <Text style={styles.text} numberOfLines={1}>{item.telefono || 'Sin teléfono'}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="pricetag-outline" size={16} color="#6B7280" />
            <Text style={styles.text} numberOfLines={1}>
              {item?.nivel_precio?.nombre ?? item?.nivel_precio_nombre ?? 'Sin nivel de precio'}
            </Text>
          </View>
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, tieneCoords ? styles.badgeOk : styles.badgeWarn]}>
            <Ionicons
              name={tieneCoords ? 'location-outline' : 'alert-circle-outline'}
              size={14}
              color={tieneCoords ? '#065F46' : '#92400E'}
            />
            <Text style={[styles.badgeText, { color: tieneCoords ? '#065F46' : '#92400E' }]}>
              {tieneCoords ? 'Ubicación configurada' : 'Sin ubicación'}
            </Text>
          </View>

          {blocked && (
            <View style={[styles.badge, styles.badgeDebt]}>
              <Ionicons name="warning-outline" size={14} color="#991B1B" />
              <Text style={[styles.badgeText, { color: '#991B1B' }]}>
                Saldo: {money(item.saldo_pendiente_total)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        ListHeaderComponent={<Header />}
        stickyHeaderIndices={[0]}
        data={clientesFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.primario]}
            tintColor={Colors.light.primario}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="file-tray-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Sin clientes</Text>
            <Text style={styles.emptyText}>No hay resultados con tu búsqueda.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomColor: '#E5E7EB', borderBottomWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  titulo: { fontSize: 20, fontWeight: '800', color: Colors.light.primario },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2F2F2', borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#E5E7EB' },
  input: { flex: 1, height: 44, color: '#111827' },
  card: { backgroundColor: '#fff', padding: 14, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nombre: { fontWeight: '800', fontSize: 16, color: '#111827', maxWidth: 210 },
  rows: { marginTop: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 14, marginLeft: 8, color: '#4B5563' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.light.primario, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actionBtnWarn: { backgroundColor: '#B91C1C' },
  actionText: { color: '#fff', fontWeight: '700' },
  badges: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1 },
  badgeWarn: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1 },
  badgeDebt: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: { paddingTop: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { fontWeight: '800', color: '#111827', fontSize: 16 },
  emptyText: { color: '#6B7280', marginBottom: 6 },
});
