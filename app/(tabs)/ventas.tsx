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
import { SafeAreaView } from 'react-native-safe-area-context';


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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <Text style={styles.titulo}>🛒 Nueva Venta</Text>

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
            <View style={styles.row}>
              <Ionicons name="person-circle-outline" size={20} color={Colors.light.primario} />
              <Text style={[styles.text, styles.bold]}>{item.nombre}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="call-outline" size={16} color={Colors.light.primario} />
              <Text style={styles.text}>{item.telefono}</Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="pricetag-outline" size={16} color={Colors.light.primario} />
              <Text style={styles.text}>{item.nivel_precio?.nombre}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16
  },
  bold: {
    fontWeight: 'bold',
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.light.primario,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  nombre: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    marginLeft: 8,
    color: '#555',
  },
});
