import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { money } from '@/src/utils/money';

/* Mismos helpers de fecha para que coincida con el modal */
const getVentaDate = (v: any): Date => {
  const cand = v?.fecha_hora || v?.fecha || v?.created_at || v?.updated_at || v?.createdAt;
  if (!cand) return new Date();
  if (typeof cand === 'number') return new Date(cand);

  if (typeof cand === 'string') {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(cand)) {
      const [d, t] = cand.split(' ');
      const [y, m, day] = d.split('-').map(Number);
      const [hh, mm, ss] = t.split(':').map(Number);
      return new Date(y, m - 1, day, hh, mm, ss);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(cand)) {
      const [y, m, day] = cand.split('-').map(Number);
      return new Date(y, m - 1, day, 0, 0, 0);
    }
    const d = new Date(cand);
    if (!isNaN(d.getTime())) return d;
  }

  return new Date(cand);
};

const formatMX = (d: Date) =>
  d.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export default function SaleCard({
  item,
  styles,
  onPress,
}: {
  item: any;
  styles: any;
  onPress: () => void;
}) {
  const fecha = formatMX(getVentaDate(item));
  const total = money(Number(item?.total || 0));
  const itemsCount =
    (Array.isArray(item?.detalles) ? item.detalles.reduce((a: number, d: any) => a + Number(d?.cantidad || 0), 0) : 0) +
    (Array.isArray(item?.rechazos) ? item.rechazos.reduce((a: number, r: any) => a + Number(r?.cantidad || 0), 0) : 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="calendar-outline" size={18} color={Colors.light.primario} />
          <Text style={styles.cardDate}> {fecha}</Text>
        </View>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Ionicons name="cube-outline" size={14} color="#374151" />
            <Text style={styles.badgeText}>{itemsCount} items</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Ionicons name="cash-outline" size={18} color={Colors.light.primario} />
        <Text style={styles.cardTotal}>{total}</Text>
      </View>

      {!!item?.observaciones && <Text style={styles.obs}>📌 {item.observaciones}</Text>}
    </TouchableOpacity>
  );
}