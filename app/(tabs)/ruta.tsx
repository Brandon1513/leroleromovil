import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  FlatList,
  RefreshControl
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function RutaOptimizada() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ubicacion, setUbicacion] = useState(null);
  const [visitados, setVisitados] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [botonDeshabilitado, setBotonDeshabilitado] = useState(false);

  const STORAGE_KEYS = {
    VISITADOS: 'clientes_visitados',
    RUTA_CERRADA: 'ruta_cerrada',
    FECHA_ESTADO: 'fecha_estado',
  };

  const getHoy = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    cargarEstadoPersistente();
    obtenerDatos();
  }, []);

  const cargarEstadoPersistente = async () => {
    const fechaGuardada = await AsyncStorage.getItem(STORAGE_KEYS.FECHA_ESTADO);
    const hoy = getHoy();

    if (fechaGuardada !== hoy) {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.VISITADOS,
        STORAGE_KEYS.RUTA_CERRADA,
        STORAGE_KEYS.FECHA_ESTADO,
      ]);
      setVisitados({});
      setBotonDeshabilitado(false);
      await AsyncStorage.setItem(STORAGE_KEYS.FECHA_ESTADO, hoy);
    } else {
      const visitadosGuardados = await AsyncStorage.getItem(STORAGE_KEYS.VISITADOS);
      const rutaCerrada = await AsyncStorage.getItem(STORAGE_KEYS.RUTA_CERRADA);
      if (visitadosGuardados) setVisitados(JSON.parse(visitadosGuardados));
      if (rutaCerrada === 'true') setBotonDeshabilitado(true);
    }
  };

  const obtenerDatos = async () => {
    try {
      setRefreshing(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permiso denegado',
          text2: 'No se puede acceder a la ubicación',
        });
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
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'No se pudo obtener la ubicación o clientes',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const guardarVisitados = async (visitadosActualizados) => {
    setVisitados(visitadosActualizados);
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.VISITADOS, JSON.stringify(visitadosActualizados)],
      [STORAGE_KEYS.FECHA_ESTADO, getHoy()],
    ]);
  };

  const verRutaCliente = (cliente) => {
    if (!ubicacion || !cliente.latitud || !cliente.longitud) return;
    const origen = `${ubicacion.latitude},${ubicacion.longitude}`;
    const destino = `${cliente.latitud},${cliente.longitud}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=driving`;
    Linking.openURL(url);
  };

  const marcarComoVisitado = (clienteId) => {
    const actualizados = { ...visitados, [clienteId]: true };
    guardarVisitados(actualizados);
    Toast.show({
      type: 'success',
      text1: 'Cliente visitado',
      text2: 'Marcado como visitado con éxito',
    });
  };

  const todosVisitados = clientes.length > 0 && clientes.every(cliente => visitados[cliente.id]);

  const solicitarCierreRuta = async () => {
    setBotonDeshabilitado(true);

    const token = await AsyncStorage.getItem('authToken');

    try {
      const res = await fetch(`${API_BASE_URL}/api/solicitar-cierre`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({})
      });

      const data = await res.json();

      if (res.ok) {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.RUTA_CERRADA, 'true'],
          [STORAGE_KEYS.FECHA_ESTADO, getHoy()],
        ]);

        Toast.show({
          type: 'success',
          text1: '✅ Ruta finalizada',
          text2: 'La solicitud de cierre fue enviada correctamente',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '❌ Error al finalizar ruta',
          text2: data.message || 'No se pudo enviar la solicitud',
        });
        setBotonDeshabilitado(false);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '🚫 Error de red',
        text2: 'No se pudo contactar con el servidor',
      });
      setBotonDeshabilitado(false);
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
    <SafeAreaView style={styles.container}>
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
                  style={[styles.finalizarBtn, botonDeshabilitado && { backgroundColor: '#aaa' }]}
                  onPress={solicitarCierreRuta}
                  disabled={botonDeshabilitado}
                >
                  <Text style={styles.finalizarText}>
                    <Ionicons name="flag-outline" size={18} color="#fff" /> Finalizar Ruta
                  </Text>
                </TouchableOpacity>
              )
            }
          />
        </>
      )}
    </SafeAreaView>
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
