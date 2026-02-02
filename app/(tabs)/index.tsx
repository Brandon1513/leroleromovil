// app/(tabs)/index.tsx  (HomeScreen)
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { homeStyle } from '@/assets/Styles/Home.style';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDraft, clearDraft } from '@/constants/draftSale';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

type Option = { id: string; label: string; icon: JSX.Element; route: string };

const baseOptions: Option[] = [
  { id: '1', label: 'Clientes',    icon: <Feather  name="users" size={32} color={Colors.light.primario} />, route: '/(tabs)/clientes' },
  { id: '2', label: 'Inventario',  icon: <Ionicons name="cube-outline" size={32} color={Colors.light.primario} />, route: '/(tabs)/inventario' },
  { id: '3', label: 'Nueva Venta', icon: <Ionicons name="add-circle-outline" size={32} color={Colors.light.primario} />, route: '/(tabs)/ventas' },
  { id: '4', label: 'Perfil',      icon: <Ionicons name="person-outline" size={32} color={Colors.light.primario} />, route: '/(tabs)/perfil' },
  { id: '5', label: 'Rutas',       icon: <Ionicons name="map-outline" size={32} color={Colors.light.primario} />, route: '/(tabs)/ruta' },
];

const MAX_DRAFT_AGE_MS = 2 * 60 * 60 * 1000; // 2h

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));

const timeAgo = (iso?: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'justo ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
};

// Mostramos el banner SOLO si hay venta realmente “activa” (con productos y total)
const shouldShowDraft = (d: any): boolean => {
  if (!d) return false;
  if (!d?.cliente?.id) return false;

  const carritoLen = Array.isArray(d.carrito) ? d.carrito.length : 0;
  if (carritoLen === 0) return false;

  const total = Number(d.total || 0);
  if (total <= 0) return false;

  const started = d.startedAt ? new Date(d.startedAt).getTime() : 0;
  if (!started || (Date.now() - started) > MAX_DRAFT_AGE_MS) return false;

  return true;
};

export default function HomeScreen() {
  const router = useRouter();
  const [options] = useState<Option[]>(baseOptions);

  const [hasDraft, setHasDraft] = useState(false);
  const [draftClient, setDraftClient] = useState<string>('');
  const [draftTotal, setDraftTotal] = useState<number>(0);
  const [draftWhen, setDraftWhen] = useState<string>('');

  const loadDraft = useCallback(async () => {
  try {
    const d = await getDraft();
    
    // ✅ Validación más estricta
    const hasClient = !!d?.cliente?.id;
    const hasItems = Array.isArray(d?.carrito) && d.carrito.length > 0;
    const hasTotal = Number(d?.total ?? 0) > 0;
    
    // ❌ Debe tener cliente Y (items O total) para ser válido
    const isValid = hasClient && (hasItems || hasTotal);
    
    const show = isValid && shouldShowDraft(d);

    // ✅ Si hay draft inválido, limpiarlo
    if (d && !isValid) {
      await clearDraft();
    }

    setHasDraft(show);

    if (show) {
      setDraftClient(d?.cliente?.nombre || '');
      setDraftTotal(Number(d?.total || 0));
      setDraftWhen(d?.startedAt || '');
    } else {
      setDraftClient('');
      setDraftTotal(0);
      setDraftWhen('');
    }
  } catch {
    setHasDraft(false);
    setDraftClient('');
    setDraftTotal(0);
    setDraftWhen('');
  }
}, []);

  useEffect(() => { loadDraft(); }, [loadDraft]);
  useFocusEffect(useCallback(() => { loadDraft(); }, [loadDraft]));

  const resumeSale = useCallback(async () => {
  const d = await getDraft();
  if (!d?.cliente?.id) return;

  const enc = encodeURIComponent(JSON.stringify({
    id: d.cliente.id,
    nombre: d.cliente.nombre || ''
  }));

  router.push({
    pathname: '/IniciarVenta',
    params: {
      cliente: enc,
      cliente_id: String(d.cliente.id), // ⚠️ IMPORTANTE: pasar cliente_id
      resume: '1',
      rid: String(d.draft_id || Date.now().toString()),
    },
  });
}, [router]);

  const discardSale = useCallback(async () => {
  try {
    await clearDraft();
    setHasDraft(false);
    setDraftClient('');
    setDraftTotal(0);
    setDraftWhen('');
    
    // ✅ Feedback opcional al usuario
    Toast.show({ 
      type: 'success', 
      text1: 'Venta descartada', 
      text2: 'Puedes iniciar una nueva venta' 
    });
  } catch (error) {
    console.error('Error al descartar venta:', error);
  }
}, []);

  const handlePress = (item: Option) => {
    if (item.id === '3' && hasDraft) {
      Alert.alert(
        'Tienes una venta sin cerrar',
        `Cliente: ${draftClient || 'N/D'}\nDebes reanudar o descartar para continuar.`,
        [
          { text: 'Descartar', style: 'destructive', onPress: discardSale },
          { text: 'Reanudar', onPress: resumeSale },
          { text: 'Cancelar', style: 'cancel' },
        ]
      );
      return;
    }
    router.push(item.route);
  };

  const renderItem = ({ item, index }: { item: Option; index: number }) => (
    <TouchableOpacity
      style={[
        homeStyle.card,
        options.length % 2 !== 0 && index === options.length - 1 && homeStyle.cardFullWidth,
        item.id === '3' && hasDraft && { opacity: 0.7 },
      ]}
      onPress={() => handlePress(item)}
      activeOpacity={0.9}
    >
      <View style={{ position: 'relative', alignItems: 'center' }}>
        {item.icon}
        {item.id === '3' && hasDraft && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Reanudar</Text>
          </View>
        )}
      </View>
      <Text style={homeStyle.label}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={homeStyle.container}>
      <Text style={homeStyle.title}>Bienvenido 👋</Text>

      {hasDraft && (
        <View style={styles.banner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={18} color="#92400E" />
            <Text style={{ color: '#92400E', fontWeight: '700' }}>Venta sin cerrar</Text>
          </View>

          <Text style={{ color: '#92400E' }}>
            {draftClient ? `Cliente: ${draftClient}` : 'Tienes una venta en borrador.'}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: '#92400E' }}>Total guardado: {money(draftTotal)}</Text>
            {!!draftWhen && <Text style={{ color: '#92400E' }}>{timeAgo(draftWhen)}</Text>}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={resumeSale} style={styles.chipPrimary}>
              <Text style={styles.chipPrimaryText}>Reanudar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={discardSale} style={styles.chipDanger}>
              <Text style={styles.chipDangerText}>Descartar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={options}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={homeStyle.grid}
      />

      <TouchableOpacity
        accessibilityLabel={hasDraft ? 'Reanudar venta en borrador' : 'Crear nueva venta'}
        style={styles.fab}
        onPress={() => (hasDraft ? resumeSale() : router.push('/(tabs)/ventas'))}
        onLongPress={() => {
          if (!hasDraft) return;
          Alert.alert('Descartar venta', '¿Deseas descartar el borrador actual?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Descartar', style: 'destructive', onPress: discardSale },
          ]);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="cart-outline" size={26} color="#fff" />
        {hasDraft && <View style={styles.fabDot} />}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  banner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },

  chipPrimary: {
    backgroundColor: Colors.light.primario,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  chipPrimaryText: { color: '#fff', fontWeight: '700' },

  chipDanger: {
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  chipDangerText: { color: '#fff', fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 26,
    right: 22,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primario,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  fabDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
