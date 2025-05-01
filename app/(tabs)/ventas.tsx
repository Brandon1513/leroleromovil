import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';

export default function Ventas() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchClientes = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/clientes`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        }
      });
      const data = await res.json();
      setClientes(data);
    } catch (error) {
      console.error('Error al cargar clientes:', error.message);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClientes();
    setRefreshing(false);
  }, []);

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const toRad = (value) => (value * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const iniciarVenta = async (cliente) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la ubicación para continuar.');
      return;
    }

    const ubicacion = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = ubicacion.coords;

    const distancia = calcularDistancia(
      latitude,
      longitude,
      cliente.latitud,
      cliente.longitud
    );

    if (distancia > 100) {
      Alert.alert(
        'Ubicación incorrecta',
        `Debes estar cerca del cliente para iniciar la venta.\nEstás a ${distancia.toFixed(0)} metros.`
      );
      return;
    }

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.primario]} // <- aquí defines el color del spinner
            tintColor={Colors.light.primario} // <- para iOS
          />
        }
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
