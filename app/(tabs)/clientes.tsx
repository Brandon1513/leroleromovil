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

export default function ClientesScreen() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // <-- agregamos esto
  const [busqueda, setBusqueda] = useState('');
  const router = useRouter();

  const fetchClientes = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/api/clientes`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error('Error al obtener clientes', error);
    } finally {
      setLoading(false);
      setRefreshing(false); // <-- detener el refresh si viene de un pull-to-refresh
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchClientes();
  }, []);

  const navegarAHistorial = (cliente) => {
    Alert.alert(
      'Historial de ventas',
      `¿Deseas ver el historial de ventas de ${cliente.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          onPress: () => {
            const clienteParam = encodeURIComponent(JSON.stringify(cliente));
            router.push(`/historial-ventas?cliente=${clienteParam}`);
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onLongPress={() => navegarAHistorial(item)}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="person-circle-outline" size={24} color={Colors.light.primario} />
          <Text style={styles.name}>{item.nombre}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="call-outline" size={18} color="#666" />
          <Text style={styles.text}>{item.telefono || 'Sin teléfono'}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="pricetag-outline" size={18} color="#666" />
          <Text style={styles.text}>
            {item.nivel_precio?.nombre || 'Sin nivel de precio'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading && !refreshing) { // <-- importante: solo cuando no está refrescando
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primario} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={[Colors.light.primario]} // <- aquí defines el color del spinner
                      tintColor={Colors.light.primario} // <- para iOS
                    /> // <-- aquí se integra
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333'
  },
  text: {
    fontSize: 14,
    marginLeft: 8,
    color: '#555'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
