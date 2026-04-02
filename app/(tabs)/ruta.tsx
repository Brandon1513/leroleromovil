// RutaOptimizada.tsx - VERSIÓN CORREGIDA
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

type MotivoNoVenta =
  | 'sin_dinero'
  | 'sin_stock_deseado'
  | 'precios_altos'
  | 'cliente_ausente'
  | 'cliente_no_necesita'
  | 'otro';

export default function RutaOptimizada() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ubicacion, setUbicacion] = useState<any>(null);
  const [visitados, setVisitados] = useState<Record<number, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [botonDeshabilitado, setBotonDeshabilitado] = useState(false);

  // ✅ BUSCADOR + FILTROS
  const [busqueda, setBusqueda] = useState('');
  const [soloNoVisitados, setSoloNoVisitados] = useState(false);

  // 🆕 Estados para el modal de registro de visita
  const [modalVisible, setModalVisible] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null);
  const [realizoVenta, setRealizoVenta] = useState<boolean | null>(null);
  const [motivoNoVenta, setMotivoNoVenta] = useState<MotivoNoVenta | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);

  const STORAGE_KEYS = {
    VISITADOS: 'clientes_visitados',
    RUTA_CERRADA: 'ruta_cerrada',
    FECHA_ESTADO: 'fecha_estado',
  };

  const MOTIVOS_NO_VENTA = [
    { value: 'sin_dinero', label: '💰 Sin dinero', icon: 'cash-outline' },
    { value: 'sin_stock_deseado', label: '📦 Sin stock deseado', icon: 'cube-outline' },
    { value: 'precios_altos', label: '💸 Precios altos', icon: 'trending-up-outline' },
    { value: 'cliente_ausente', label: '🚪 Cliente ausente', icon: 'person-remove-outline' },
    { value: 'cliente_no_necesita', label: '✋ No necesita producto', icon: 'hand-left-outline' },
    { value: 'otro', label: '📝 Otro motivo', icon: 'ellipsis-horizontal-outline' },
  ];

  const getHoy = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    (async () => {
      // ✅ IMPORTANTE: Primero verificar el día, luego cargar datos del backend
      await verificarCambioDia();


      // 🆕 Verificar si fue liberado por el admin
      await verificarSiFueLiberado();

      await obtenerDatos();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ CORREGIDO: Verificar cambio de día SIN cargar estado local aún
  const verificarCambioDia = async () => {
    const fechaGuardada = await AsyncStorage.getItem(STORAGE_KEYS.FECHA_ESTADO);
    const hoy = getHoy();

    if (fechaGuardada !== hoy) {
      // 🔄 Nuevo día: limpiar todo
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.VISITADOS,
        STORAGE_KEYS.RUTA_CERRADA,
        STORAGE_KEYS.FECHA_ESTADO,
      ]);
      setVisitados({});
      setBotonDeshabilitado(false);
      await AsyncStorage.setItem(STORAGE_KEYS.FECHA_ESTADO, hoy);
    } else {
      // ✅ Mismo día: solo cargar el estado de ruta cerrada (NO los visitados)
      const rutaCerrada = await AsyncStorage.getItem(STORAGE_KEYS.RUTA_CERRADA);
      if (rutaCerrada === 'true') setBotonDeshabilitado(true);
    }
  };

  // 🆕 Verificar si el admin liberó al vendedor
  const verificarSiFueLiberado = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/api/estado-venta`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;

      const data = await res.json();
      


      // ✅ Si fue liberado (ventas_bloqueadas = false), limpiar el estado local
      if (data.fue_liberado === true) {
        
        await AsyncStorage.removeItem(STORAGE_KEYS.RUTA_CERRADA);
        setBotonDeshabilitado(false);

        Toast.show({
          type: 'success',
          text1: '✅ Ruta liberada',
          text2: 'Ya puedes finalizar ruta nuevamente',
        });
      }
    } catch (error) {
      console.error('Error al verificar liberación:', error);
    }
  };

  const obtenerDatos = async () => {
    try {
      setRefreshing(true);

      // 🆕 Verificar si fue liberado antes de cargar clientes
      await verificarSiFueLiberado();

      // 1️⃣ Obtener ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permiso denegado',
          text2: 'No se puede acceder a la ubicación',
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const ubicacionActual = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUbicacion(ubicacionActual.coords);

      // 2️⃣ Obtener clientes del día desde el backend
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Toast.show({
          type: 'error',
          text1: 'Sin autenticación',
          text2: 'No se encontró el token de acceso',
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/clientes-dia`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error del servidor:', errorText);
        Toast.show({
          type: 'error',
          text1: 'Error del servidor',
          text2: `Status: ${res.status}`,
        });
        setClientes([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await res.json();


      if (Array.isArray(data)) {
        // ✅ Ordenar clientes por distancia desde ubicación actual
        const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371e3;
          const toRad = (v: number) => (v * Math.PI) / 180;
          const φ1 = toRad(lat1), φ2 = toRad(lat2);
          const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
          const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const clientesOrdenados = [...data].sort((a: any, b: any) => {
          const coords = ubicacionActual.coords;
          const aLat = parseFloat(a.latitud), aLon = parseFloat(a.longitud);
          const bLat = parseFloat(b.latitud), bLon = parseFloat(b.longitud);
          const aOk = !isNaN(aLat) && !isNaN(aLon);
          const bOk = !isNaN(bLat) && !isNaN(bLon);
          if (!aOk && !bOk) return 0;
          if (!aOk) return 1;  // sin coordenadas van al final
          if (!bOk) return -1;
          const dA = calcDist(coords.latitude, coords.longitude, aLat, aLon);
          const dB = calcDist(coords.latitude, coords.longitude, bLat, bLon);
          return dA - dB;
        });

        setClientes(clientesOrdenados);

        // ✅ CORREGIDO: El backend es la fuente de verdad
        const visitadosDelBackend: Record<number, boolean> = {};
        data.forEach((cliente: any) => {
          if (cliente.ya_visitado) {
            // 🔧 IMPORTANTE: Normalizar ID a número
            visitadosDelBackend[Number(cliente.id)] = true;
          }
        });



        // ✅ CAMBIO CLAVE: Usar SOLO el estado del backend (no combinar con local)
        setVisitados(visitadosDelBackend);

        // ✅ Guardar en local para mantener coherencia hasta el próximo fetch
        await AsyncStorage.setItem(
          STORAGE_KEYS.VISITADOS,
          JSON.stringify(visitadosDelBackend)
        );

        
      } else {
        console.error('❌ Respuesta no es un array:', data);
        setClientes([]);
      }
    } catch (error: any) {
      console.error('💥 Error completo:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error?.message || 'No se pudo obtener los datos',
      });
      setClientes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const guardarVisitados = async (visitadosActualizados: Record<number, boolean>) => {
    setVisitados(visitadosActualizados);
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.VISITADOS, JSON.stringify(visitadosActualizados)],
      [STORAGE_KEYS.FECHA_ESTADO, getHoy()],
    ]);
  };

  const verRutaCliente = (cliente: any) => {
    if (!ubicacion || !cliente.latitud || !cliente.longitud) {
      Toast.show({
        type: 'error',
        text1: 'Sin coordenadas',
        text2: 'No se puede trazar la ruta sin ubicación',
      });
      return;
    }
    const origen = `${ubicacion.latitude},${ubicacion.longitude}`;
    const destino = `${cliente.latitud},${cliente.longitud}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=driving`;
    Linking.openURL(url);
  };

  // 🆕 Abrir modal para registrar visita
  const abrirModalVisita = (cliente: any) => {
    setClienteSeleccionado(cliente);
    setRealizoVenta(null);
    setMotivoNoVenta(null);
    setObservaciones('');
    setModalVisible(true);
  };

  // 🆕 Registrar visita en el backend
  const registrarVisita = async () => {
    if (realizoVenta === null) {
      Toast.show({
        type: 'error',
        text1: 'Selección requerida',
        text2: 'Indica si se realizó venta o no',
      });
      return;
    }

    if (realizoVenta === false && !motivoNoVenta) {
      Toast.show({
        type: 'error',
        text1: 'Motivo requerido',
        text2: 'Selecciona el motivo por el que no se realizó venta',
      });
      return;
    }

    setGuardando(true);

    try {
      const token = await AsyncStorage.getItem('authToken');

      const body = {
        cliente_id: clienteSeleccionado.id,
        realizo_venta: realizoVenta,
        motivo_no_venta: realizoVenta ? null : motivoNoVenta,
        observaciones: observaciones.trim() || null,
        latitud: ubicacion?.latitude || null,
        longitud: ubicacion?.longitude || null,
      };

      const res = await fetch(`${API_BASE_URL}/api/visitas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ Marcar como visitado localmente
        const actualizados = { ...visitados, [clienteSeleccionado.id]: true };
        await guardarVisitados(actualizados);

        Toast.show({
          type: 'success',
          text1: '✅ Visita registrada',
          text2: realizoVenta ? 'Venta registrada exitosamente' : 'Visita sin venta registrada',
        });

        setModalVisible(false);
      } else {
        Toast.show({
          type: 'error',
          text1: '❌ Error al registrar',
          text2: data.message || 'No se pudo guardar la visita',
        });
      }
    } catch (error) {
      console.error('Error al registrar visita:', error);
      Toast.show({
        type: 'error',
        text1: '🚫 Error de red',
        text2: 'No se pudo contactar con el servidor',
      });
    } finally {
      setGuardando(false);
    }
  };

  // 🔧 MEJORADO: Normalizar IDs para la comparación
  const todosVisitados = clientes.length > 0 && clientes.every((cliente: any) => {
    const id = Number(cliente.id);
    return visitados[id] === true;
  });

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
        body: JSON.stringify({}),
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

  // ✅ FILTRADO POR BUSQUEDA + SOLO NO VISITADOS
  const clientesFiltrados = clientes.filter((c: any) => {
    const q = busqueda.trim().toLowerCase();

    const matchQ =
      !q ||
      String(c?.nombre ?? '').toLowerCase().includes(q) ||
      String(c?.telefono ?? '').toLowerCase().includes(q) ||
      String(c?.id ?? '').includes(q);

    const matchVisitado = soloNoVisitados ? !visitados?.[c?.id] : true;

    return matchQ && matchVisitado;
  });

  const renderItem = ({ item }: any) => (
    <View style={[styles.card, visitados[item.id] && { opacity: 0.6 }]}>
      <Text style={styles.nombre}>{item.nombre}</Text>
      <Text style={styles.coordenadas}>
        {item.latitud && item.longitud && ubicacion
          ? (() => {
              const R = 6371e3;
              const toRad = (v: number) => (v * Math.PI) / 180;
              const φ1 = toRad(ubicacion.latitude), φ2 = toRad(parseFloat(item.latitud));
              const Δφ = toRad(parseFloat(item.latitud) - ubicacion.latitude);
              const Δλ = toRad(parseFloat(item.longitud) - ubicacion.longitude);
              const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
              const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              return d < 1000 ? `📍 ${d.toFixed(0)} m de distancia` : `📍 ${(d/1000).toFixed(1)} km de distancia`;
            })()
          : item.latitud && item.longitud ? '📍 Ubicación registrada' : '📍 Sin ubicación'
        }
      </Text>

      {!visitados[item.id] ? (
        <View style={styles.botonesContainer}>
          <TouchableOpacity style={styles.botonRuta} onPress={() => verRutaCliente(item)}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
            <Text style={styles.textoBoton}>Ver Ruta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.botonVisita} onPress={() => abrirModalVisita(item)}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.textoBoton}>Registrar Visita</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.completadoContainer}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.completado}>Visitado</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>🗺️ Ruta Optimizada</Text>


      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.light.primario} />
          <Text style={{ marginTop: 12, color: '#6B7280' }}>Cargando clientes del día...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.info}>
            Clientes del día: {clientes.length} | Visitados:{' '}
            {Object.keys(visitados).filter((k) => visitados[Number(k)]).length}
          </Text>

          {/* ✅ BUSCADOR */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, teléfono o ID..."
              value={busqueda}
              onChangeText={setBusqueda}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {busqueda !== '' && (
              <TouchableOpacity onPress={() => setBusqueda('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filtersRow}>
            <TouchableOpacity
              onPress={() => setSoloNoVisitados((v) => !v)}
              style={[styles.filterChip, soloNoVisitados && styles.filterChipActive]}
            >
              <Ionicons
                name={soloNoVisitados ? 'checkbox' : 'square-outline'}
                size={16}
                color={soloNoVisitados ? '#fff' : '#374151'}
              />
              <Text style={[styles.filterChipText, soloNoVisitados && styles.filterChipTextActive]}>
                Solo no visitados
              </Text>
            </TouchableOpacity>

            <Text style={styles.searchHint}>
              Mostrando {clientesFiltrados.length} de {clientes.length}
            </Text>
          </View>

          <FlatList
            data={clientesFiltrados}
            keyExtractor={(item: any) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={obtenerDatos}
                colors={[Colors.light.primario]}
                tintColor={Colors.light.primario}
              />
            }
            ListEmptyComponent={
              clientes.length > 0 && (busqueda.trim() || soloNoVisitados) ? (
                <View style={styles.empty}>
                  <Ionicons name="search-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>Sin resultados</Text>
                  <Text style={styles.emptyText}>
                    No encontramos coincidencias con tu búsqueda o filtros.
                  </Text>
                </View>
              ) : (
                <View style={styles.empty}>
                  <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>Sin clientes hoy</Text>
                  <Text style={styles.emptyText}>
                    No hay clientes asignados para este día de la semana.
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              todosVisitados && clientes.length > 0 ? (
                <TouchableOpacity
                  style={[styles.finalizarBtn, botonDeshabilitado && { backgroundColor: '#aaa' }]}
                  onPress={solicitarCierreRuta}
                  disabled={botonDeshabilitado}
                >
                  <Ionicons name="flag-outline" size={18} color="#fff" />
                  <Text style={styles.finalizarText}>
                    {botonDeshabilitado ? 'Ruta Finalizada' : 'Finalizar Ruta'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </>
      )}

      {/* 🆕 MODAL PARA REGISTRAR VISITA */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitulo}>📋 Registrar Visita</Text>

              <Text style={styles.clienteNombre}>
                Cliente: {clienteSeleccionado?.nombre}
              </Text>

              {/* Pregunta principal */}
              <Text style={styles.pregunta}>¿Se realizó venta?</Text>

              <View style={styles.opcionesContainer}>
                <TouchableOpacity
                  style={[
                    styles.opcionBtn,
                    realizoVenta === true && styles.opcionBtnActiva,
                  ]}
                  onPress={() => {
                    setRealizoVenta(true);
                    setMotivoNoVenta(null);
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={32}
                    color={realizoVenta === true ? '#10B981' : '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.opcionTexto,
                      realizoVenta === true && styles.opcionTextoActiva,
                    ]}
                  >
                    SÍ, se realizó venta
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.opcionBtn,
                    realizoVenta === false && styles.opcionBtnActiva,
                  ]}
                  onPress={() => setRealizoVenta(false)}
                >
                  <Ionicons
                    name="close-circle"
                    size={32}
                    color={realizoVenta === false ? '#EF4444' : '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.opcionTexto,
                      realizoVenta === false && styles.opcionTextoActiva,
                    ]}
                  >
                    NO, no se realizó venta
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Motivos si NO hubo venta */}
              {realizoVenta === false && (
                <>
                  <Text style={styles.pregunta}>¿Por qué no se realizó la venta?</Text>

                  {MOTIVOS_NO_VENTA.map((motivo) => (
                    <TouchableOpacity
                      key={motivo.value}
                      style={[
                        styles.motivoBtn,
                        motivoNoVenta === motivo.value && styles.motivoBtnActivo,
                      ]}
                      onPress={() => setMotivoNoVenta(motivo.value as MotivoNoVenta)}
                    >
                      <Ionicons
                        name={motivo.icon as any}
                        size={20}
                        color={
                          motivoNoVenta === motivo.value
                            ? Colors.light.primario
                            : '#6B7280'
                        }
                      />
                      <Text
                        style={[
                          styles.motivoTexto,
                          motivoNoVenta === motivo.value && styles.motivoTextoActivo,
                        ]}
                      >
                        {motivo.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Observaciones */}
              <Text style={styles.label}>Observaciones (opcional):</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Ej: Cliente pidió que vuelva la próxima semana..."
                value={observaciones}
                onChangeText={setObservaciones}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.contador}>{observaciones.length}/500 caracteres</Text>

              {/* Botones */}
              <View style={styles.botonesModal}>
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setModalVisible(false)}
                  disabled={guardando}
                >
                  <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnGuardar,
                    (realizoVenta === null || guardando) && { opacity: 0.5 },
                  ]}
                  onPress={registrarVisita}
                  disabled={realizoVenta === null || guardando}
                >
                  {guardando ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnGuardarTexto}>Guardar Visita</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
  },
  titulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.primario,
    marginBottom: 16,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    color: '#6B7280',
    fontWeight: '600',
  },

  // ✅ buscador
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#111827',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterChipActive: {
    backgroundColor: Colors.light.primario,
    borderColor: Colors.light.primario,
  },
  filterChipText: {
    fontWeight: '700',
    fontSize: 12,
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  searchHint: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  nombre: {
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
    color: '#111827',
  },
  coordenadas: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  botonesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  botonRuta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.light.primario,
    padding: 12,
    borderRadius: 8,
  },
  botonVisita: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
  },
  textoBoton: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  completadoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  completado: {
    color: '#10B981',
    fontWeight: '700',
  },
  finalizarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: '#8B008B',
    padding: 14,
    borderRadius: 10,
  },
  finalizarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.primario,
    marginBottom: 8,
    textAlign: 'center',
  },
  clienteNombre: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  pregunta: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  opcionesContainer: {
    gap: 12,
    marginBottom: 16,
  },
  opcionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  opcionBtnActiva: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.light.primario,
  },
  opcionTexto: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  opcionTextoActiva: {
    color: '#111827',
    fontWeight: '700',
  },
  motivoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  motivoBtnActivo: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.light.primario,
  },
  motivoTexto: {
    fontSize: 14,
    color: '#6B7280',
  },
  motivoTextoActivo: {
    color: Colors.light.primario,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  contador: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  botonesModal: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  btnCancelar: {
    flex: 1,
    padding: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCancelarTexto: {
    color: '#111827',
    fontWeight: '700',
  },
  btnGuardar: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.light.primario,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGuardarTexto: {
    color: '#fff',
    fontWeight: '700',
  },
});