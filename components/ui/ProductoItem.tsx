import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export default function ProductoItem({ item, cantidad, onAdd, onRemove }) {
  return (
    <View style={styles.card}>
      <Text style={styles.nombre}>
        <Ionicons name="pricetag-outline" size={16} color={Colors.light.primario} /> {item.producto.nombre}
      </Text>
      <Text style={styles.text}>
        <Ionicons name="cube-outline" size={14} color={Colors.light.primario} /> Cantidad disponible: {item.cantidad}
      </Text>
      <Text style={styles.text}>
        <Ionicons name="calendar-outline" size={14} color={Colors.light.primario} /> Caduca: {item.producto.fecha_caducidad}
      </Text>

      <View style={styles.controls}>
        <TouchableOpacity onPress={onRemove} style={styles.controlButton}>
          <Ionicons name="remove-circle-outline" size={24} color={Colors.light.primario} />
        </TouchableOpacity>
        <Text style={styles.counter}>{cantidad}</Text>
        <TouchableOpacity onPress={onAdd} style={styles.controlButton}>
          <Ionicons name="add-circle-outline" size={24} color={Colors.light.primario} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 3
  },
  nombre: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6
  },
  text: {
    fontSize: 14,
    color: '#555'
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12
  },
  controlButton: {
    marginHorizontal: 10
  },
  counter: {
    fontSize: 18,
    fontWeight: 'bold'
  }
});
