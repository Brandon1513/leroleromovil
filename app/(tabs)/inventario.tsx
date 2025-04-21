import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';


export default function InventarioScreen() {
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const fetchInventario = async () => {
      const token = await AsyncStorage.getItem('authToken');

      const res = await fetch('http://192.168.100.16/api/inventario', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setInventario(data);
    };

    fetchInventario();
  }, []);

  const inventarioFiltrado = inventario.filter(item =>
    item.producto.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📦 Mi Inventario</Text>

      <TextInput
        placeholder="🔍 Buscar producto..."
        value={busqueda}
        onChangeText={setBusqueda}
        style={styles.input}
      />

      <FlatList
        data={inventarioFiltrado}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.nombre}>
              <Ionicons name="pricetag-outline" size={16} color={Colors.light.primario}  /> {item.producto.nombre}
            </Text>
            <Text style={styles.text}>
              <Ionicons name="cube-outline" size={14} color={Colors.light.primario}  /> Cantidad: {item.cantidad}
            </Text>
            <Text style={styles.text}>
              <Ionicons name="calendar-outline" size={14} color={Colors.light.primario}  /> Caduca: {item.producto.fecha_caducidad}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.vacio}>No se encontraron productos</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
    backgroundColor: '#f2f2f2'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: Colors.light.primario,
    textAlign: 'center'
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 12
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
    elevation: 3
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6
  },
  text: {
    fontSize: 14,
    color: '#555',
    marginTop: 2
  },
  vacio: {
    marginTop: 30,
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic'
  }
});
