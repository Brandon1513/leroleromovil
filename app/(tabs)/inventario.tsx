import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  RefreshControl,
  Image,
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
  const [refreshing, setRefreshing] = useState(false);

  const fetchInventario = async () => {
    const token = await AsyncStorage.getItem('authToken');

    try {
      const [invRes, promoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/inventario`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API_BASE_URL}/api/promociones`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
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

  useEffect(() => {
    fetchInventario();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventario();
  }, []);

  const inventarioFiltrado = Array.isArray(inventario)
    ? inventario.filter(item =>
        item.producto?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : [];

  const promocionesFiltradas = Array.isArray(promociones)
    ? promociones.filter(item =>
        item.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📦 Mi Inventario</Text>

      <TextInput
        placeholder="🔍 Buscar producto o promoción..."
        value={busqueda}
        onChangeText={setBusqueda}
        style={styles.input}
      />

      <FlatList
        data={[...promocionesFiltradas.map(p => ({ ...p, isPromo: true })), ...inventarioFiltrado]}
        keyExtractor={(item, index) => `item-${item.id}-${index}`}
        renderItem={({ item }) =>
          item.isPromo ? (
            <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 5 }]}>
              <Text style={[styles.nombre, { color: 'purple' }]}>🔥 Promoción: {item.nombre}</Text>
              <Text style={styles.text}>📋 {item.descripcion}</Text>
              <Text style={styles.text}>💰 Precio Promo: ${item.precio}</Text>
              <Text style={styles.text}>🕒 Vigencia: {item.fecha_inicio} a {item.fecha_fin}</Text>
              <Text style={styles.text}>🧃 Incluye:</Text>
              {item.productos?.map((prod, idx) => (
                <Text key={idx} style={styles.text}>• {prod.nombre} (x{prod.pivot?.cantidad})</Text>
              ))}
            </View>
          ) : (
            <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 5 }]}>
              {item.producto?.imagen_url && (
                <Image source={{ uri: item.producto.imagen_url }} style={styles.image} resizeMode="contain" />
              )}
              
              {/* 🆕 Mostrar categoría si existe */}
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
  container: {
    padding: 16,
    flex: 1,
    backgroundColor: '#f2f2f2',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.light.primario,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  // 🆕 Estilos para la etiqueta de categoría
  categoriaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoriaText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.light.primario,
    textTransform: 'uppercase',
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  vacio: {
    marginTop: 30,
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
});