import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import Filters from '@/components/ventas/Filters';
import SaleCard from '@/components/ventas/SaleCard';
import SaleModal from '@/components/ventas/SaleModal';
import { useVentas } from '@/hooks/useVentas';
import { money } from '@/src/utils/money';

export default function HistorialVentas() {
  const router = useRouter();
  const { cliente, from } = useLocalSearchParams();
  const clienteSel = cliente ? JSON.parse(decodeURIComponent(cliente as string)) : null;

  const {
    ventas, loading, refreshing, onRefresh,
    fechaInicio, setFechaInicio,
    fechaFin, setFechaFin,
    producto, setProducto,
    limpiarFiltros, rangoRapido,
    resumen
  } = useVentas(clienteSel?.id);

  // logo base64 (solo para PDF en el modal)
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const logoModule = require('@/assets/images/lerolero-logo.png');
        const asset = Asset.fromModule(logoModule);
        if (!asset.localUri) await asset.downloadAsync();
        const b64 = await FileSystem.readAsStringAsync(asset.localUri!, { encoding: FileSystem.EncodingType.Base64 });
        setLogoBase64(`data:image/png;base64,${b64}`);
      } catch {
        setLogoBase64(null);
      }
    })();
  }, []);

  const [ventaSel, setVentaSel] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const goBack = useCallback(() => {
    if (from === 'clientes') router.replace('/clientes');
    else router.back();
    return true;
  }, [from, router]);

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
          <Text style={styles.subtitulo}>{clienteSel?.nombre}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {/* Filtros */}
      <Filters
        fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
        fechaFin={fechaFin} setFechaFin={setFechaFin}
        producto={producto} setProducto={setProducto}
        limpiarFiltros={limpiarFiltros} rangoRapido={rangoRapido}
        styles={styles}
      />

      {/* Lista */}
      <FlatList
        data={ventas}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }) => (
          <SaleCard
            item={item}
            styles={styles}
            onPress={() => { setVentaSel(item); setModalVisible(true); }}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={<Empty />}
      />

      {/* Resumen */}
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
      <SaleModal
        visible={modalVisible}
        venta={ventaSel}
        onClose={() => { setModalVisible(false); setVentaSel(null); }}
        styles={styles}
        logoBase64={logoBase64}
      />
    </SafeAreaView>
  );
}

/* Styles (tus originales) */
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
