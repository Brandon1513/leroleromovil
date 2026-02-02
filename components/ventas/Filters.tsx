// components/ventas/Filters.tsx
import React from 'react';
import { View, TouchableOpacity, Text, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  fechaInicio: Date | null; setFechaInicio: (d: Date | null) => void;
  fechaFin: Date | null; setFechaFin: (d: Date | null) => void;
  producto: string; setProducto: (s: string) => void;
  limpiarFiltros: () => void; rangoRapido: (n: number) => void;
  styles: any;
};

export default function Filters({
  fechaInicio, setFechaInicio,
  fechaFin, setFechaFin,
  producto, setProducto,
  limpiarFiltros, rangoRapido,
  styles
}: Props) {
  const [showIni, setShowIni] = React.useState(false);
  const [showFin, setShowFin] = React.useState(false);

  return (
    <View style={styles.filtros}>
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.chip} onPress={() => rangoRapido(1)}>
          <Text style={styles.chipText}>Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={() => rangoRapido(7)}>
          <Text style={styles.chipText}>7 días</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={() => rangoRapido(30)}>
          <Text style={styles.chipText}>30 días</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, styles.chipClear]} onPress={limpiarFiltros}>
          <Ionicons name="broom-outline" size={14} color="#111827" />
          <Text style={[styles.chipText, { color: '#111827' }]}>Limpiar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.datesRow}>
        <TouchableOpacity style={styles.fechaBtn} onPress={() => setShowIni(true)}>
          <Ionicons name="calendar" size={16} color="#374151" />
          <Text style={styles.fechaText}>Desde: {fechaInicio ? new Date(fechaInicio).toLocaleDateString() : '...'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fechaBtn} onPress={() => setShowFin(true)}>
          <Ionicons name="calendar" size={16} color="#374151" />
          <Text style={styles.fechaText}>Hasta: {fechaFin ? new Date(fechaFin).toLocaleDateString() : '...'}</Text>
        </TouchableOpacity>
      </View>

      {showIni && (
        <DateTimePicker
          value={fechaInicio ? new Date(fechaInicio) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => { setShowIni(false); if (date) setFechaInicio(date); }}
        />
      )}
      {showFin && (
        <DateTimePicker
          value={fechaFin ? new Date(fechaFin) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => { setShowFin(false); if (date) setFechaFin(date); }}
        />
      )}

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#6B7280" />
        <TextInput
          placeholder="Buscar producto..."
          style={styles.input}
          value={producto}
          onChangeText={setProducto}
        />
        {!!producto && (
          <TouchableOpacity onPress={() => setProducto('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
