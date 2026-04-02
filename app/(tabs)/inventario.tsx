import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InventarioScreen() {
  const [inventario, setInventario] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

      if (Array.isArray(invData)) setInventario(invData);
      else setInventario([]);

      if (Array.isArray(promoData.promociones)) setPromociones(promoData.promociones);
      else setPromociones([]);
    } catch (error) {
      console.error('Error al obtener datos:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInventario();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventario();
  }, []);

  // Extraer categorías únicas del inventario
  const categorias = useMemo(() => {
    const cats = new Map<string, string>();
    (inventario as any[]).forEach(item => {
      const cat = item.producto?.categoria;
      if (cat?.id && cat?.nombre) {
        cats.set(String(cat.id), cat.nombre);
      }
    });
    return Array.from(cats.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [inventario]);

  const inventarioFiltrado = useMemo(() => {
    return (Array.isArray(inventario) ? inventario : []).filter((item: any) => {
      const matchBusqueda = item.producto?.nombre?.toLowerCase().includes(busqueda.toLowerCase());
      const matchCategoria = !categoriaActiva || String(item.producto?.categoria?.id) === categoriaActiva;
      return matchBusqueda && matchCategoria;
    });
  }, [inventario, busqueda, categoriaActiva]);

  const promocionesFiltradas = useMemo(() => {
    return (Array.isArray(promociones) ? promociones : []).filter((item: any) =>
      item.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [promociones, busqueda]);

  const data = [
    ...promocionesFiltradas.map((p: any) => ({ ...p, isPromo: true })),
    ...inventarioFiltrado,
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📦 Mi Inventario</Text>

      {/* Buscador */}
      <TextInput
        placeholder="🔍 Buscar producto o promoción..."
        value={busqueda}
        onChangeText={setBusqueda}
        style={styles.input}
      />

      {/* Chips de categorías */}
      {categorias.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContainer}
        >
          <TouchableOpacity
            style={[styles.chip, !categoriaActiva && styles.chipActivo]}
            onPress={() => setCategoriaActiva(null)}
          >
            <Text style={[styles.chipText, !categoriaActiva && styles.chipTextActivo]}>
              Todos
            </Text>
          </TouchableOpacity>

          {categorias.map(cat => {
            const activo = categoriaActiva === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, activo && styles.chipActivo]}
                onPress={() => setCategoriaActiva(activo ? null : cat.id)}
              >
                <Text style={[styles.chipText, activo && styles.chipTextActivo]}>
                  {cat.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <FlatList
        data={data}
        keyExtractor={(item: any, index) => `item-${item.id ?? index}-${index}`}
        renderItem={({ item }: any) =>
          item.isPromo ? (
            <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 5 }]}>
              <Text style={[styles.nombre, { color: 'purple' }]}>🔥 Promoción: {item.nombre}</Text>
              <Text style={styles.text}>📋 {item.descripcion}</Text>
              <Text style={styles.text}>💰 Precio Promo: ${item.precio}</Text>
              <Text style={styles.text}>🕒 Vigencia: {item.fecha_inicio} a {item.fecha_fin}</Text>
              <Text style={styles.text}>🧃 Incluye:</Text>
              {item.productos?.map((prod: any, idx: number) => (
                <Text key={idx} style={styles.text}>• {prod.nombre} (x{prod.pivot?.cantidad})</Text>
              ))}
            </View>
          ) : (
            <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 5 }]}>
              {item.producto?.imagen_url && (
                <Image source={{ uri: item.producto.imagen_url }} style={styles.image} resizeMode="contain" />
              )}

              {item.producto?.categoria && (
                <View style={styles.categoriaTag}>
                  <Ionicons name="pricetags" size={12} color={Colors.light.primario} />
                  <Text style={styles.categoriaText}>{item.producto.categoria.nombre}</Text>
                </View>
              )}

              <Text style={styles.nombre}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.light.primario} /> {item.producto?.nombre}
              </Text>
              <Text style={styles.text}>
                <Ionicons name="barcode-outline" size={14} color={Colors.light.primario} /> Lote: {item.lote}
              </Text>
              <Text style={styles.text}>
                <Ionicons name="calendar-outline" size={14} color={Colors.light.primario} /> Caduca: {item.fecha_caducidad || 'N/D'}
              </Text>
              <Text style={styles.text}>
                <Ionicons name="cube-outline" size={14} color={Colors.light.primario} /> Cantidad: {item.cantidad}
              </Text>
              <Text style={styles.text}>
                <Ionicons name="cash-outline" size={14} color={Colors.light.primario} /> Precio: ${Number(item.producto?.precio).toFixed(2)}
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          <Text style={styles.vacio}>No se encontraron productos ni promociones</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.primario]}
            tintColor={Colors.light.primario}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1, backgroundColor: '#f2f2f2' },
  title: {
    fontSize: 24, fontWeight: 'bold', marginBottom: 16,
    color: Colors.light.primario, textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: '#ddd', marginBottom: 10,
  },
  chipsScroll: { marginBottom: 12 },
  chipsContainer: { flexDirection: 'row', gap: 8, paddingRight: 16, paddingLeft: 2, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, height: 36,
    borderRadius: 999, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    flexShrink: 0, justifyContent: 'center', alignItems: 'center',
  },
  chipActivo: {
    backgroundColor: Colors.light.primario,
    borderColor: Colors.light.primario,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActivo: { color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1,
    shadowRadius: 3, elevation: 3,
  },
  categoriaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, alignSelf: 'flex-start', marginBottom: 8,
  },
  categoriaText: {
    fontSize: 11, fontWeight: '600',
    color: Colors.light.primario, textTransform: 'uppercase',
  },
  nombre: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  text: { fontSize: 14, color: '#555', marginTop: 2 },
  vacio: { marginTop: 30, textAlign: 'center', color: '#888', fontStyle: 'italic' },
  image: { width: '100%', height: 150, borderRadius: 8, marginBottom: 8 },
});