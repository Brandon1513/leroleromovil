import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  FlatList,
  RefreshControl
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';

export default function RutaOptimizada() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ubicacion, setUbicacion] = useState(null);
  const [visitados, setVisitados] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    obtenerDatos();
  }, []);

  const obtenerDatos = async () => {
    try {
      setRefreshing(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'No se puede acceder a la ubicación');
        return;
      }

      const ubicacionActual = await Location.getCurrentPositionAsync({});
      setUbicacion(ubicacionActual.coords);

      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/clientes-dia`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setClientes(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener la ubicación o clientes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const verRutaCliente = (cliente) => {
    if (!ubicacion || !cliente.latitud || !cliente.longitud) return;
    const origen = `${ubicacion.latitude},${ubicacion.longitude}`;
    const destino = `${cliente.latitud},${cliente.longitud}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=driving`;
    Linking.openURL(url);
  };

  const marcarComoVisitado = (clienteId) => {
    Alert.alert(
      '¿Finalizar visita?',
      '¿Deseas marcar este cliente como visitado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            setVisitados(prev => ({ ...prev, [clienteId]: true }));
          }
        }
      ]
    );
  };

  const todosVisitados = clientes.length > 0 && clientes.every(cliente => visitados[cliente.id]);

  const solicitarCierreRuta = async () => {
    const token = await AsyncStorage.getItem('authToken');

    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitar-cierre`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inventario_final: [],  // Aquí podrías reemplazar si capturas inventario final
          cambios: []            // Igual para productos en cambio
        })
      });

      const data = await res.json();

      if (res.ok) {
        Alert.alert("✅ Éxito", "La solicitud de cierre fue enviada.");
      } else {
        Alert.alert("⚠️ Error", data.message || "No se pudo enviar la solicitud.");
      }
    } catch (error) {
      Alert.alert("🚫 Error", "Error de red al enviar la solicitud.");
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, visitados[item.id] && { opacity: 0.6 }]}
      onLongPress={() => !visitados[item.id] && marcarComoVisitado(item.id)}
      disabled={visitados[item.id]}
    >
      <Text style={styles.nombre}>{item.nombre}</Text>
      <Text>📍 Lat: {item.latitud || 'N/D'} | Lon: {item.longitud || 'N/D'}</Text>
      {!visitados[item.id] ? (
        <TouchableOpacity style={styles.botonRuta} onPress={() => verRutaCliente(item)}>
          <Text style={styles.textoRuta}>📍 Ver Ruta</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.completado}>✅ Visitado</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>🗺️ Ruta Optimizada</Text>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.light.primario} />
      ) : (
        <>
          <Text style={styles.info}>Clientes del día: {clientes.length}</Text>

          <FlatList
            data={clientes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={obtenerDatos}
                colors={[Colors.light.primario]}
                tintColor={Colors.light.primario}
              />
            }
            ListFooterComponent={
              todosVisitados && (
                <TouchableOpacity
                  style={styles.finalizarBtn}
                  onPress={solicitarCierreRuta}
                >
                  <Text style={styles.finalizarText}>🚩 Finalizar Ruta</Text>
                </TouchableOpacity>
              )
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
    paddingBottom: 40
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.primario,
    marginBottom: 16,
    textAlign: 'center',
  },
  info: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
  },
  nombre: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  botonRuta: {
    marginTop: 10,
    backgroundColor: Colors.light.primario,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  textoRuta: {
    color: '#fff',
    fontWeight: 'bold',
  },
  completado: {
    marginTop: 10,
    color: 'green',
    fontWeight: 'bold',
  },
  finalizarBtn: {
    marginTop: 20,
    backgroundColor: '#8B008B',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  finalizarText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
