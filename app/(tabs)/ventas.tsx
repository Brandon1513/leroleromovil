import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

export default function Ventas() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchClientes = async () => {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch('http://192.168.100.16/api/clientes', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        }
      });
      const data = await res.json();
      setClientes(data);
    };

    fetchClientes();
  }, []);

  const iniciarVenta = (cliente) => {
    Alert.alert(
      'Iniciar venta',
      `¿Deseas iniciar una venta para ${cliente.nombre}?`,
      [
        { text: 'CANCELAR', style: 'cancel' },
        {
          text: 'ACEPTAR',
          onPress: () => {
            const encoded = encodeURIComponent(JSON.stringify(cliente));
            router.push(`/IniciarVenta?cliente=${encoded}`);
          },
        },
      ]
    );
  };

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Nueva Venta</Text>

      <TextInput
        placeholder="Buscar cliente..."
        value={busqueda}
        onChangeText={setBusqueda}
        style={styles.input}
      />

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => iniciarVenta(item)}
            style={styles.card}
          >
            <Text style={styles.nombre}>
              <Ionicons name="person-circle-outline" size={18} color={Colors.light.primario} /> {item.nombre}
            </Text>
            <Text>
              <Ionicons name="call-outline" size={14} color={Colors.light.primario} /> {item.telefono}
            </Text>
            <Text>
              <Ionicons name="pricetag-outline" size={14} color={Colors.light.primario} /> {item.negocio}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: Colors.light.primario
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
  },
  nombre: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
});
