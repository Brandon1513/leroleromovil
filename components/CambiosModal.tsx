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
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CambiosModal({
  visible,
  productos,
  cambiosVenta,
  setCambiosVenta,
  onConfirmar,   // registra la venta al terminar
  onClose,
}) {
  const modificarCantidad = (item, incremento) => {
    const index = cambiosVenta.findIndex((p) => p.producto_id === item.producto_id);
    if (index >= 0) {
      const copia = [...cambiosVenta];
      const nuevaCantidad = Math.max(0, (Number(copia[index].cantidad) || 0) + incremento);
      copia[index].cantidad = nuevaCantidad;
      // Si queda en 0, opcionalmente podríamos limpiar motivo
      if (nuevaCantidad === 0) copia[index].motivo = '';
      setCambiosVenta(copia);
    } else if (incremento > 0) {
      setCambiosVenta([
        ...cambiosVenta,
        {
          producto_id: item.producto_id,
          producto: item?.producto?.nombre || 'Producto',
          cantidad: 1,
          motivo: '',
          lote: item?.lote || null,
          fecha_caducidad: item?.fecha_caducidad || null,
        },
      ]);
    }
  };

  const cambiarMotivo = (item, motivo) => {
    setCambiosVenta(prev =>
      prev.map(p =>
        p.producto_id === item.producto_id ? { ...p, motivo } : p
      )
    );
  };

  const getCambio = (producto_id) =>
    cambiosVenta.find((p) => p.producto_id === producto_id) || { cantidad: 0, motivo: '' };

  const enviarCambios = async () => {
    const cambiosValidos = cambiosVenta.filter(c => Number(c.cantidad) > 0 && c.motivo);
    const cambiosIncompletos = cambiosVenta.filter(c => Number(c.cantidad) > 0 && !c.motivo);

    if (cambiosIncompletos.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Motivo requerido',
        text2: 'Selecciona un motivo para todos los productos con cantidad mayor a 0.',
      });
      return;
    }

    // Si no hay cambios, cerramos y continuamos con la venta
    if (cambiosValidos.length === 0) {
      Toast.show({ type: 'info', text1: 'No hay cambios registrados' });
      onClose?.();
      onConfirmar?.();
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
        Toast.show({ type: 'success', text1: '✅ Cambios registrados correctamente', visibilityTime: 5000 });
        onClose?.();
        onConfirmar?.(); // guarda la venta y descuenta inventario
      } else {
        const data = await response.json();
        Toast.show({
          type: 'error',
          text1: 'Error al guardar cambios',
          text2: data?.message || 'Ocurrió un error',
          visibilityTime: 4000,
        });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error de red', text2: String(error?.message || error) });
    }
  };

  const RenderItem = ({ item }) => {
    const cambio = getCambio(item.producto_id);
    const qty = Number(cambio.cantidad) || 0;

    return (
      <View style={styles.card}>
        <Text style={styles.nombre} numberOfLines={2}>
          {item?.producto?.nombre || 'Producto'}
        </Text>

        {(item?.lote || item?.fecha_caducidad) && (
          <Text style={styles.meta} numberOfLines={1}>
            {item?.lote ? `Lote: ${item.lote}` : ''}{item?.lote && item?.fecha_caducidad ? '  ·  ' : ''}
            {item?.fecha_caducidad ? `Cad.: ${item.fecha_caducidad}` : ''}
          </Text>
        )}

        <View style={styles.controles}>
          <TouchableOpacity onPress={() => modificarCantidad(item, -1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="remove-circle-outline" size={26} color={Colors.light.primario} />
          </TouchableOpacity>

          <Text style={styles.cantidad}>{qty}</Text>

          <TouchableOpacity onPress={() => modificarCantidad(item, 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add-circle-outline" size={26} color={Colors.light.primario} />
          </TouchableOpacity>
        </View>

        {qty > 0 && (
          <View style={styles.motivoSelect}>
            {['caducidad', 'no vendido', 'dañado'].map((motivo) => {
              const activo = cambio.motivo === motivo;
              return (
                <TouchableOpacity
                  key={motivo}
                  onPress={() => cambiarMotivo(item, motivo)}
                  style={[styles.motivoBtn, activo && styles.motivoBtnActivo]}
                >
                  <Text style={[styles.motivoText, activo && styles.motivoTextActivo]}>
                    {motivo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>♻️ Productos en Cambio</Text>

          <FlatList
            data={Array.isArray(productos) ? productos : []}
            keyExtractor={(item, index) =>
              item?.producto_id ? String(item.producto_id) : String(index)
            }
            renderItem={RenderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          />

          <TouchableOpacity style={styles.confirmarBtn} onPress={enviarCambios}>
            <Text style={styles.confirmarText}>Guardar cambios y continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.confirmarBtn, styles.btnSec]} onPress={onClose}>
            <Text style={[styles.confirmarText, styles.btnSecText]}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    color: Colors.light.primario,
  },
  separator: { height: 8 },
  card: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  nombre: {
    fontWeight: '800',
    color: '#111827',
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cantidad: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  motivoSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  motivoBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  motivoBtnActivo: {
    backgroundColor: Colors.light.primario,
    borderColor: Colors.light.primario,
  },
  motivoText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 12,
  },
  motivoTextActivo: {
    color: '#fff',
  },
  confirmarBtn: {
    marginTop: 12,
    backgroundColor: Colors.light.primario,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmarText: { color: '#fff', fontWeight: '800' },
  btnSec: { backgroundColor: '#EEE' },
  btnSecText: { color: '#111827' },
});
