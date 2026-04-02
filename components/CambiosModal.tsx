// CambiosModal.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/Config';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';

type CambioTicketItem = {
  producto: string;
  cantidad: number;
  motivo?: string;
  lote?: string | null;
  fecha_caducidad?: string | null;
  sustituciones?: Array<{
    producto: string;
    cantidad: number;
    lote?: string | null;
    fecha_caducidad?: string | null;
  }>;
};

type CambiosSaveResult = {
  rechazosIds?: number[];
  ticketItems?: CambioTicketItem[];
};

type Props = {
  visible: boolean;
  productos: any[];
  cambiosVenta: any[];
  setCambiosVenta: (v: any[] | ((prev: any[]) => any[])) => void;
  onConfirmar?: (res?: CambiosSaveResult) => void; // ✅ ahora regresa data al padre
  onClose?: () => void;
  ventaId?: number | null; // ✅ ID de la venta ya creada para vincular rechazos
};

export default function CambiosModal({
  visible,
  productos,
  cambiosVenta,
  setCambiosVenta,
  onConfirmar,
  onClose,
  ventaId,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [targetCambioKey, setTargetCambioKey] = useState<string | null>(null);
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

  const inventario = Array.isArray(productos) ? productos : [];

  // 🔑 clave única por renglón de inventario (producto+lote+cad)
  const invKeyOf = (invItem: any) =>
    `${invItem?.producto_id ?? 'x'}|${invItem?.lote ?? 'null'}|${invItem?.fecha_caducidad ?? 'null'}`;

  // 🔑 clave única del cambio (devuelto) también basado en (producto+lote+cad)
  const changeKeyOf = (invItem: any) => invKeyOf(invItem);

  const getNombre = (item: any) => item?.producto?.nombre || item?.producto?.name || 'Producto';

  const getCambio = (invItem: any) => {
    const k = changeKeyOf(invItem);
    return (
      cambiosVenta.find((p: any) => p._key === k) || {
        _key: k,
        producto_id: invItem?.producto_id,
        producto: getNombre(invItem),
        cantidad: 0,
        motivo: '',
        lote: invItem?.lote || null,
        fecha_caducidad: invItem?.fecha_caducidad || null,
        sustituciones: [], // [{inv_key, producto_id, nombre, lote, fecha_caducidad, cantidad, disponible}]
      }
    );
  };

  const totalEntregado = (cambio: any) =>
    (cambio?.sustituciones || []).reduce((acc: number, s: any) => acc + (Number(s.cantidad) || 0), 0);

  const restantePorEntregar = (cambio: any) =>
    Math.max(0, (Number(cambio.cantidad) || 0) - totalEntregado(cambio));

  // suma global “reservada” por inv_key para no exceder stock si se usa mismo lote en varios cambios
  const reservedGlobalForInvKey = (inv_key: string) => {
    let sum = 0;
    for (const c of cambiosVenta || []) {
      for (const s of c?.sustituciones || []) {
        if (s?.inv_key === inv_key) sum += Number(s.cantidad) || 0;
      }
    }
    return sum;
  };

  const modificarCantidad = (invItem: any, incremento: number) => {
    const k = changeKeyOf(invItem);
    const index = cambiosVenta.findIndex((p: any) => p._key === k);

    if (index >= 0) {
      const copia = [...cambiosVenta];
      const nuevaCantidad = Math.max(0, (Number(copia[index].cantidad) || 0) + incremento);
      copia[index].cantidad = nuevaCantidad;

      // Si baja, ajustar sustituciones para que no excedan la nueva cantidad
      const entregado = totalEntregado(copia[index]);
      if (entregado > nuevaCantidad) {
        let exceso = entregado - nuevaCantidad;
        const sust = [...(copia[index].sustituciones || [])];
        for (let i = sust.length - 1; i >= 0 && exceso > 0; i--) {
          const q = Number(sust[i].cantidad) || 0;
          const quitar = Math.min(q, exceso);
          sust[i].cantidad = q - quitar;
          exceso -= quitar;
          if ((Number(sust[i].cantidad) || 0) <= 0) sust.splice(i, 1);
        }
        copia[index].sustituciones = sust;
      }

      // Si queda 0, limpia todo
      if (nuevaCantidad === 0) {
        copia[index].motivo = '';
        copia[index].sustituciones = [];
      }

      setCambiosVenta(copia);
    } else if (incremento > 0) {
      setCambiosVenta([
        ...cambiosVenta,
        {
          _key: k,
          producto_id: invItem.producto_id,
          producto: getNombre(invItem),
          cantidad: 1,
          motivo: '',
          lote: invItem?.lote || null,
          fecha_caducidad: invItem?.fecha_caducidad || null,
          sustituciones: [],
        },
      ]);
    }
  };

  const cambiarMotivo = (invItem: any, motivo: string) => {
    const k = changeKeyOf(invItem);
    setCambiosVenta((prev: any[]) => prev.map((p) => (p._key === k ? { ...p, motivo } : p)));
  };

  const abrirPicker = (invItem: any) => {
    const cambio = getCambio(invItem);
    if ((Number(cambio.cantidad) || 0) <= 0) return;

    if (restantePorEntregar(cambio) <= 0) {
      Toast.show({
        type: 'info',
        position: 'top',
        text1: 'Ya está cubierto el cambio',
        text2: 'No puedes entregar más productos que la cantidad en cambio.',
      });
      return;
    }

    setTargetCambioKey(cambio._key);
    setBuscar('');
    setPickerVisible(true);
  };

  const addSustitucion = (cambioKey: string, invItem: any) => {
    const inv_key = invKeyOf(invItem);
    const disponible = Number(invItem?.cantidad) || 0;

    const yaReservado = reservedGlobalForInvKey(inv_key);
    const disponibleReal = Math.max(0, disponible - yaReservado);

    setCambiosVenta((prev: any[]) =>
      prev.map((c) => {
        if (c._key !== cambioKey) return c;

        const rest = restantePorEntregar(c);
        if (rest <= 0) return c;

        const qty = Math.min(1, rest, disponibleReal);
        if (qty <= 0) {
          Toast.show({
            type: 'error',
            position: 'top',
            text1: 'Sin stock disponible',
            text2: 'Ese producto/lote ya no tiene stock suficiente.',
          });
          return c;
        }

        const nueva = {
          inv_key,
          producto_id: invItem?.producto_id ?? null,
          nombre: getNombre(invItem),
          lote: invItem?.lote ?? null,
          fecha_caducidad: invItem?.fecha_caducidad ?? null,
          cantidad: qty,
          disponible, // stock original para mostrar
        };

        return { ...c, sustituciones: [...(c.sustituciones || []), nueva] };
      })
    );
  };

  const removeSustitucion = (cambioKey: string, idx: number) => {
    setCambiosVenta((prev: any[]) =>
      prev.map((c) => {
        if (c._key !== cambioKey) return c;
        const list = [...(c.sustituciones || [])];
        list.splice(idx, 1);
        return { ...c, sustituciones: list };
      })
    );
  };

  const setSustQty = (cambioKey: string, idx: number, value: string) => {
    const want = Math.max(0, parseInt(String(value || '0'), 10) || 0);

    setCambiosVenta((prev: any[]) =>
      prev.map((c) => {
        if (c._key !== cambioKey) return c;

        const sust = [...(c.sustituciones || [])];
        const row = sust[idx];
        if (!row) return c;

        const inv_key = row.inv_key;
        const stockOriginal = Number(row.disponible) || 0;

        const reservadoGlobal = reservedGlobalForInvKey(inv_key);
        const actualEnFila = Number(row.cantidad) || 0;
        const disponibleRealParaFila = Math.max(0, stockOriginal - (reservadoGlobal - actualEnFila));

        // no exceder el cambio
        const entregadoSinFila = totalEntregado(c) - actualEnFila;
        const maxPorCambio = Math.max(0, (Number(c.cantidad) || 0) - entregadoSinFila);

        const maxPermitido = Math.min(disponibleRealParaFila, maxPorCambio);
        const finalQty = Math.min(want, maxPermitido);

        row.cantidad = finalQty;

        // si queda 0, eliminar fila
        if (finalQty <= 0) sust.splice(idx, 1);

        return { ...c, sustituciones: sust };
      })
    );
  };

  const categorias = useMemo(() => {
    const cats = new Map<string, string>();
    inventario.forEach((it: any) => {
      const cat = it?.producto?.categoria;
      if (cat?.id && cat?.nombre) cats.set(String(cat.id), cat.nombre);
    });
    return Array.from(cats.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [inventario]);

  // Filtro para el modal principal (lista de productos a devolver)
  const inventarioFiltradoPrincipal = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return inventario.filter((it: any) => {
      const matchBuscar = !q || (getNombre(it) || '').toLowerCase().includes(q);
      const matchCategoria = !categoriaActiva || String(it?.producto?.categoria?.id) === categoriaActiva;
      return matchBuscar && matchCategoria;
    });
  }, [buscar, categoriaActiva, inventario]);

  const pickerData = useMemo(() => {
    const base = inventario.filter((it) => (Number(it?.cantidad) || 0) > 0);
    const q = buscar.trim().toLowerCase();

    return base.filter((it) => {
      const matchBuscar = !q || (() => {
        const nombre = (getNombre(it) || '').toLowerCase();
        const lote = (it?.lote || '').toLowerCase();
        return nombre.includes(q) || lote.includes(q) || String(it?.producto_id || '').includes(q);
      })();
      const matchCategoria = !categoriaActiva || String(it?.producto?.categoria?.id) === categoriaActiva;
      return matchBuscar && matchCategoria;
    });
  }, [buscar, categoriaActiva, inventario]);

  const RenderPickerItem = ({ item }: any) => {
    const inv_key = invKeyOf(item);
    const stock = Number(item?.cantidad) || 0;

    const reservado = reservedGlobalForInvKey(inv_key);
    const disponibleReal = Math.max(0, stock - reservado);

    if (disponibleReal <= 0) return null;

    return (
      <TouchableOpacity
        style={styles.pickRow}
        onPress={() => {
          if (!targetCambioKey) return;
          addSustitucion(targetCambioKey, item);
          setPickerVisible(false);
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.pickName} numberOfLines={2}>
            {getNombre(item)}
          </Text>
          <Text style={styles.pickMeta} numberOfLines={1}>
            ID: {item?.producto_id} · Lote: {item?.lote || 'N/D'} · Cad.: {item?.fecha_caducidad || 'N/D'}
          </Text>
          <Text style={styles.pickStock} numberOfLines={1}>
            Stock: {stock} · Disponible: {disponibleReal}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  const enviarCambios = async () => {
    const cambiosConCantidad = (cambiosVenta || []).filter((c: any) => (Number(c.cantidad) || 0) > 0);

    // 0) Si no hay cambios, NO debería continuar (porque eligió “SÍ”)
    if (cambiosConCantidad.length === 0) {
      Toast.show({
        type: 'error',
        position: 'top',
        text1: 'Sin cambios',
        text2: 'Selecciona al menos 1 producto en cambio.',
      });
      return;
    }

    // 1) Motivo requerido
    const incompletosMotivo = cambiosConCantidad.filter((c: any) => !c.motivo);
    if (incompletosMotivo.length > 0) {
      Toast.show({
        type: 'error',
        position: 'top',
        text1: 'Motivo requerido',
        text2: 'Selecciona un motivo para todos los productos con cantidad mayor a 0.',
      });
      return;
    }

    // 2) Validaciones por cambio
    for (const c of cambiosConCantidad) {
      const qtyCambio = Number(c.cantidad) || 0;

      // 2.1) Sustituciones obligatorias
      if (!Array.isArray(c.sustituciones) || c.sustituciones.length === 0) {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Falta producto entregado',
          text2: `En "${c.producto}" debes agregar al menos 1 producto a entregar.`,
        });
        return;
      }

      // 2.2) No permitir filas en 0
      const sustCero = (c.sustituciones || []).some((s: any) => (Number(s.cantidad) || 0) <= 0);
      if (sustCero) {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Cantidad inválida',
          text2: `En "${c.producto}" hay un producto entregado con cantidad 0.`,
        });
        return;
      }

      // 2.3) No exceder
      const entregado = totalEntregado(c);
      if (entregado > qtyCambio + 0.0001) {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Entrega excedida',
          text2: `En "${c.producto}", estás entregando más de lo devuelto.`,
        });
        return;
      }

      // 2.4) EXACTO: entregar exactamente lo mismo que lo devuelto
      if (Math.abs(entregado - qtyCambio) > 0.0001) {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Entrega incompleta',
          text2: `En "${c.producto}" debes entregar exactamente ${qtyCambio}. Actualmente: ${entregado}.`,
        });
        return;
      }

      // 2.5) Validar stock real por sustitución (contra disponible real considerando reservas)
      for (const s of c.sustituciones || []) {
        const inv_key = s.inv_key;
        const stockOriginal = Number(s.disponible) || 0;
        const qty = Number(s.cantidad) || 0;

        // reservado global pero devolvemos lo de esta misma fila
        const reservadoGlobal = reservedGlobalForInvKey(inv_key);
        const actualEnFila = qty;
        const disponibleRealParaFila = Math.max(0, stockOriginal - (reservadoGlobal - actualEnFila));

        if (qty > disponibleRealParaFila + 0.0001) {
          Toast.show({
            type: 'error',
            position: 'top',
            text1: 'Stock insuficiente',
            text2: `No hay stock suficiente para "${s.nombre}".`,
          });
          return;
        }
      }
    }

    // ✅ Payload alineado a tu endpoint
    const payload = cambiosConCantidad.map((c: any) => ({
      producto_id: c.producto_id,
      cantidad: Number(c.cantidad),
      motivo: c.motivo,
      lote: c.lote ?? null,
      fecha_caducidad: c.fecha_caducidad ?? null,
      sustituciones: (c.sustituciones || []).map((s: any) => ({
        producto_id: s.producto_id,
        cantidad: Number(s.cantidad),
        lote: s.lote ?? null,
        fecha_caducidad: s.fecha_caducidad ?? null,
      })),
    }));

    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/rechazos`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cambios: payload, venta_id: ventaId ?? null }), // ✅ vincular venta
      });

      // ✅ intenta leer JSON (si no hay body, no truena)
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        // ✅ construir lo que vas a imprimir (ticket)
        const ticketItems: CambioTicketItem[] = cambiosConCantidad.map((c: any) => ({
          producto: c.producto,
          cantidad: Number(c.cantidad),
          motivo: c.motivo,
          lote: c.lote ?? null,
          fecha_caducidad: c.fecha_caducidad ?? null,
          sustituciones: (c.sustituciones || []).map((s: any) => ({
            producto: s.nombre,
            cantidad: Number(s.cantidad),
            lote: s.lote ?? null,
            fecha_caducidad: s.fecha_caducidad ?? null,
          })),
        }));

        // ✅ ids que devuelva tu API (si existen)
        // ✅ ids que devuelva tu API (soporta rechazos_ids o rechazos[])
        const rechazosIds: number[] =
          Array.isArray(data?.rechazos_ids)
            ? data.rechazos_ids.map((x: any) => Number(x)).filter((n: any) => !isNaN(n))
            : Array.isArray(data?.rechazos)
              ? data.rechazos.map((r: any) => Number(r?.id)).filter((n: any) => !isNaN(n))
              : Array.isArray(data?.rechazosIds)
                ? data.rechazosIds.map((x: any) => Number(x)).filter((n: any) => !isNaN(n))
                : [];
        console.log('♻️ Rechazos IDs devueltos por API:', rechazosIds);
 

        Toast.show({ type: 'success', position: 'top', text1: '✅ Cambios registrados', visibilityTime: 2500 });

        onClose?.();
        onConfirmar?.({ ticketItems, rechazosIds }); // ✅ ahora regresamos info al padre
      } else {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Error al guardar cambios',
          text2: data?.message || 'Ocurrió un error',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        position: 'top',
        text1: 'Error de red',
        text2: String(error?.message || error),
      });
    }
  };

  const RenderItem = ({ item }: any) => {
    const cambio = getCambio(item);
    const qty = Number(cambio.cantidad) || 0;
    const entregado = totalEntregado(cambio);
    const restante = restantePorEntregar(cambio);

    return (
      <View style={styles.card}>
        <Text style={styles.nombre} numberOfLines={2}>
          {getNombre(item)}
        </Text>

        {(item?.lote || item?.fecha_caducidad) && (
          <Text style={styles.meta} numberOfLines={1}>
            {item?.lote ? `Lote: ${item.lote}` : ''}
            {item?.lote && item?.fecha_caducidad ? ' · ' : ''}
            {item?.fecha_caducidad ? `Cad.: ${item.fecha_caducidad}` : ''}
          </Text>
        )}

        <View style={styles.controles}>
          <TouchableOpacity
            onPress={() => modificarCantidad(item, -1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="remove-circle-outline" size={26} color={Colors.light.primario} />
          </TouchableOpacity>

          <Text style={styles.cantidad}>{qty}</Text>

          <TouchableOpacity
            onPress={() => modificarCantidad(item, 1)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={26} color={Colors.light.primario} />
          </TouchableOpacity>
        </View>

        {qty > 0 && (
          <>
            {/* Motivos */}
            <View style={styles.motivoSelect}>
              {['caducidad', 'no vendido', 'dañado', 'otro'].map((motivo) => {
                const activo = cambio.motivo === motivo;
                return (
                  <TouchableOpacity
                    key={motivo}
                    onPress={() => cambiarMotivo(item, motivo)}
                    style={[styles.motivoBtn, activo && styles.motivoBtnActivo]}
                  >
                    <Text style={[styles.motivoText, activo && styles.motivoTextActivo]}>{motivo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sustituciones */}
            <View style={styles.sustBox}>
              <Text style={styles.sustTitle}>Entregar sustitución (obligatorio)</Text>

              <Text style={styles.sustHint}>
                En cambio: <Text style={{ fontWeight: '900' }}>{qty}</Text> · Entregado:{' '}
                <Text style={{ fontWeight: '900' }}>{entregado}</Text> · Restante:{' '}
                <Text style={{ fontWeight: '900' }}>{restante}</Text>
              </Text>

              {(cambio.sustituciones || []).length > 0 && (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {cambio.sustituciones.map((s: any, idx: number) => (
                    <View key={`${s.inv_key}-${idx}`} style={styles.sustRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sustName} numberOfLines={2}>
                          {s.nombre}
                        </Text>
                        <Text style={styles.sustMeta} numberOfLines={1}>
                          Lote: {s.lote || 'N/D'} · Cad.: {s.fecha_caducidad || 'N/D'} · Stock: {s.disponible}
                        </Text>
                      </View>

                      <TextInput
                        style={styles.sustQtyInput}
                        keyboardType="number-pad"
                        value={String(s.cantidad ?? 0)}
                        onChangeText={(v) => setSustQty(cambio._key, idx, v)}
                        placeholder="0"
                      />

                      <TouchableOpacity onPress={() => removeSustitucion(cambio._key, idx)} style={styles.sustDel}>
                        <Ionicons name="trash-outline" size={16} color="#991B1B" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.sustBtn, restante <= 0 && { opacity: 0.5 }]}
                onPress={() => abrirPicker(item)}
                disabled={restante <= 0}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.sustBtnText}>Agregar producto entregado</Text>
              </TouchableOpacity>

              <Text style={styles.sustFoot}>* Lo entregado se descuenta de inventario pero NO se suma a la venta.</Text>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
        <SafeAreaView style={styles.overlay}>
          <View style={styles.container}>
            <Text style={styles.title}>♻️ Productos en Cambio</Text>

            {/* Buscador */}
            <View style={[styles.searchBox, { marginBottom: 8 }]}>
              <Ionicons name="search-outline" size={18} color="#6B7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar producto..."
                value={buscar}
                onChangeText={setBuscar}
              />
              {buscar !== '' && (
                <TouchableOpacity onPress={() => setBuscar('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Chips de categorías */}
            {categorias.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
                contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}
              >
                <TouchableOpacity
                  style={[styles.catChip, !categoriaActiva && styles.catChipActivo]}
                  onPress={() => setCategoriaActiva(null)}
                >
                  <Text style={[styles.catChipText, !categoriaActiva && styles.catChipTextActivo]}>Todos</Text>
                </TouchableOpacity>
                {categorias.map(cat => {
                  const activo = categoriaActiva === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, activo && styles.catChipActivo]}
                      onPress={() => setCategoriaActiva(activo ? null : cat.id)}
                    >
                      <Text style={[styles.catChipText, activo && styles.catChipTextActivo]}>{cat.nombre}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <FlatList
              data={inventarioFiltradoPrincipal}
              keyExtractor={(item, index) => changeKeyOf(item) || String(index)}
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

      {/* Picker */}
      <Modal animationType="slide" transparent visible={pickerVisible} onRequestClose={() => setPickerVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={styles.pickerBox}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Elegir producto a entregar</Text>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Ionicons name="close" size={22} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#6B7280" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre, lote o ID…"
                  value={buscar}
                  onChangeText={setBuscar}
                />
              </View>

              {categorias.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 10 }}
                  contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}
                >
                  <TouchableOpacity
                    style={[styles.catChip, !categoriaActiva && styles.catChipActivo]}
                    onPress={() => setCategoriaActiva(null)}
                  >
                    <Text style={[styles.catChipText, !categoriaActiva && styles.catChipTextActivo]}>Todos</Text>
                  </TouchableOpacity>
                  {categorias.map(cat => {
                    const activo = categoriaActiva === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.catChip, activo && styles.catChipActivo]}
                        onPress={() => setCategoriaActiva(activo ? null : cat.id)}
                      >
                        <Text style={[styles.catChipText, activo && styles.catChipTextActivo]}>{cat.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <FlatList
                data={pickerData}
                keyExtractor={(item, index) => `pick-${invKeyOf(item) || index}`}
                renderItem={RenderPickerItem}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={{ paddingBottom: 14 }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      <Toast topOffset={60} />
    </>
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
    paddingVertical: 10,
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
  motivoTextActivo: { color: '#fff' },

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

  sustBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sustTitle: { fontWeight: '900', color: '#111827' },
  sustHint: { marginTop: 6, color: '#374151', fontSize: 12 },
  sustFoot: { marginTop: 8, color: '#6B7280', fontSize: 11 },

  sustBtn: {
    marginTop: 12,
    backgroundColor: Colors.light.primario,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  sustBtnText: { color: '#fff', fontWeight: '800' },

  sustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sustName: { fontWeight: '900', color: '#111827' },
  sustMeta: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  sustQtyInput: {
    width: 70,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    textAlign: 'right',
    fontWeight: '900',
    color: '#111827',
  },
  sustDel: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  pickerBox: {
    backgroundColor: '#fff',
    padding: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  pickerTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#111827', fontWeight: '600' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, height: 34,
    borderRadius: 999, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
    flexShrink: 0, justifyContent: 'center', alignItems: 'center', marginBottom: 17,
    },
  catChipActivo: { backgroundColor: Colors.light.primario, borderColor: Colors.light.primario },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  catChipTextActivo: { color: '#fff' },
  pickRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickName: { fontWeight: '900', color: '#111827' },
  pickMeta: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  pickStock: { marginTop: 4, color: '#065F46', fontSize: 12, fontWeight: '800' },
});