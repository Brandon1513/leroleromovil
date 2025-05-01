import React from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/Config';
import Toast from 'react-native-toast-message';

export default function CambiosModal({
  visible,
  productos,
  cambiosVenta,
  setCambiosVenta,
  onConfirmar,
  onClose,
  finalizarVenta,
}) {
  const modificarCantidad = (item, incremento) => {
    const index = cambiosVenta.findIndex((p) => p.producto_id === item.producto.id);
    if (index >= 0) {
      const copia = [...cambiosVenta];
      const nuevaCantidad = Math.max(0, copia[index].cantidad + incremento);
      copia[index].cantidad = nuevaCantidad;
      setCambiosVenta(copia);
    } else if (incremento > 0) {
      setCambiosVenta([
        ...cambiosVenta,
        {
          producto_id: item.producto.id,
          producto: item.producto.nombre,
          cantidad: 1,
          motivo: '',
        },
      ]);
    }
  };

  const cambiarMotivo = (item, motivo) => {
    setCambiosVenta(prev =>
      prev.map(p =>
        p.producto_id === item.producto.id ? { ...p, motivo } : p
      )
    );
  };

  const getCambio = (producto_id) => cambiosVenta.find(p => p.producto_id === producto_id) || { cantidad: 0, motivo: '' };

  const enviarCambios = async () => {
    const cambiosValidos = cambiosVenta.filter(c => c.cantidad > 0 && c.motivo);
    const cambiosIncompletos = cambiosVenta.filter(c => c.cantidad > 0 && !c.motivo);

    if (cambiosIncompletos.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Motivo requerido',
        text2: 'Selecciona un motivo para todos los productos con cantidad mayor a 0.',
      });
      return;
    }

    if (cambiosValidos.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'No hay cambios registrados',
      });
      onClose();
      finalizarVenta();
      return;
    }

    try {
      const token = await AsyncStorage.getItem('authToken');

      const response = await fetch(`${API_BASE_URL}/api/rechazos`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cambios: cambiosValidos }),
      });

      if (response.ok) {
        Toast.show({ type: 'success', text1: '✅ Cambios registrados correctamente' });
        onClose();
        finalizarVenta();
      } else {
        const data = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Error al guardar cambios',
          text2: data.message || 'Ocurrió un error',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error de red',
        text2: error.message,
      });
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>♻️ Productos en Cambio</Text>

          <FlatList
            data={productos}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const cambio = getCambio(item.producto.id);
              return (
                <View style={styles.card}>
                  <Text style={styles.nombre}>{item.producto.nombre}</Text>
                  <View style={styles.controles}>
                    <TouchableOpacity onPress={() => modificarCantidad(item, -1)}>
                      <Ionicons name="remove-circle-outline" size={24} color={Colors.light.primario} />
                    </TouchableOpacity>
                    <Text style={styles.cantidad}>{cambio.cantidad}</Text>
                    <TouchableOpacity onPress={() => modificarCantidad(item, 1)}>
                      <Ionicons name="add-circle-outline" size={24} color={Colors.light.primario} />
                    </TouchableOpacity>
                  </View>
                  {cambio.cantidad > 0 && (
                    <View style={styles.motivoSelect}>
                      {['caducidad', 'no vendido', 'dañado'].map((motivo) => (
                        <TouchableOpacity
                          key={motivo}
                          onPress={() => cambiarMotivo(item, motivo)}
                          style={[styles.motivoBtn, cambio.motivo === motivo && styles.activo]}
                        >
                          <Text style={styles.motivoText}>{motivo}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            }}
          />

          <TouchableOpacity
            style={styles.confirmarBtn}
            onPress={async () => {
              const cambiosValidos = cambiosVenta.filter(c => c.cantidad > 0 && c.motivo);
              const cambiosIncompletos = cambiosVenta.filter(c => c.cantidad > 0 && !c.motivo);

              if (cambiosIncompletos.length > 0) {
                Toast.show({
                  type: 'error',
                  text1: 'Motivo requerido',
                  text2: 'Selecciona un motivo para todos los productos con cantidad mayor a 0.',
                });
                return;
              }

              if (cambiosValidos.length === 0) {
                Toast.show({
                  type: 'info',
                  text1: 'No hay cambios registrados',
                });
                onClose();
                onConfirmar(); // <-- se llama aquí para asegurar que la venta sí se registra
                return;
              }

              try {
                const token = await AsyncStorage.getItem('authToken');
                const response = await fetch(`${API_BASE_URL}/api/rechazos`, {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ cambios: cambiosValidos }),
                });

                if (response.ok) {
                  Toast.show({ type: 'success', text1: '✅ Cambios registrados correctamente' });
                  onClose();
                  onConfirmar(); // <-- registrar la venta después de guardar cambios
                } else {
                  const data = await response.json();
                  Toast.show({
                    type: 'error',
                    text1: 'Error al guardar cambios',
                    text2: data.message || 'Ocurrió un error',
                  });
                }
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Error de red',
                  text2: error.message,
                });
              }
            }}
          >
            <Text style={styles.confirmarText}>Guardar cambios y continuar</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  container: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  card: { marginBottom: 12 },
  nombre: { fontWeight: 'bold' },
  controles: { flexDirection: 'row', alignItems: 'center', marginVertical: 6, gap: 10 },
  cantidad: { fontSize: 16, fontWeight: 'bold' },
  motivoSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  motivoBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activo: {
    backgroundColor: Colors.light.primario,
    borderColor: Colors.light.primario,
  },
  motivoText: { color: '#333', fontSize: 13 },
  confirmarBtn: {
    marginTop: 16,
    backgroundColor: Colors.light.primario,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmarText: { color: '#fff', fontWeight: 'bold' },
});
