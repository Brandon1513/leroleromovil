import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ClientesScreen() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const router = useRouter();

  const fetchClientes = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/api/clientes`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setClientes(data || []);
    } catch (error) {
      console.error('Error al obtener clientes', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchClientes(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClientes();
  }, []);

  const navegarAHistorial = (cliente: any) => {
    Alert.alert(
      'Historial de ventas',
      `¿Deseas ver el historial de ventas de ${cliente.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: () => {
            const clienteParam = encodeURIComponent(JSON.stringify(cliente));
            const rid = Date.now().toString();
            router.push(`/historial-ventas?cliente=${clienteParam}&rid=${rid}&from=clientes`);
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => navegarAHistorial(item)} // tap en toda la card
    >
      <View style={styles.card}>
        {/* Encabezado con nombre e icono de acción a la derecha */}
        <View style={styles.headerRow}>
          <View style={styles.row}>
            <Ionicons name="person-circle-outline" size={24} color={Colors.light.primario} />
            <Text style={styles.name}>{item.nombre}</Text>
          </View>

          {/* Botón explícito de Historial */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navegarAHistorial(item)}
            accessibilityRole="button"
            accessibilityLabel={`Ver historial de ${item.nombre}`}
          >
            <Ionicons name="time-outline" size={18} color="#fff" />
            <Text style={styles.actionText}>Historial</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Ionicons name="call-outline" size={18} color="#666" />
          <Text style={styles.text}>{item.telefono || 'Sin teléfono'}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="pricetag-outline" size={18} color="#666" />
          <Text style={styles.text}>{item.nivel_precio?.nombre || 'Sin nivel de precio'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const clientesFiltrados = clientes.filter(c =>
    (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.titulo}>📋 Clientes</Text>
            <TextInput
              style={styles.input}
              placeholder="Buscar cliente..."
              value={busqueda}
              onChangeText={setBusqueda}
            />
          </View>
        }
        stickyHeaderIndices={[0]}
        data={clientesFiltrados}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
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
  headerContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    borderRadius: 12,
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.light.primario,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  list: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // nombre a la izq, botón a la der
    marginBottom: 6
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: 'bold', marginLeft: 8, color: '#333' },
  text: { fontSize: 14, marginLeft: 8, color: '#555' },

  // Botón de acción “Historial”
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.light.primario,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionText: { color: '#fff', fontWeight: '600' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
