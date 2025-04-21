import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export default function ClientesScreen() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const fetchClientes = async () => {
      const token = await AsyncStorage.getItem('authToken');
      try {
        const res = await fetch('http://192.168.100.16/api/clientes', {
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
      }
    };

    fetchClientes();
  }, []);

  const renderItem = ({ item }) => (
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
  );

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) {
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
