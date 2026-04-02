// IniciarVenta.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  Alert, Image, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Colors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/Config';
import CambiosModal from '@/components/CambiosModal';
import ResumenVentaModal from '@/components/ventas/ResumenVentaModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDraft, setDraft, clearDraft } from '@/constants/draftSale';
import * as Random from 'expo-random';

// Helpers de dinero
const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n || 0));

// Helpers de fecha
const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

const newClientTxId = () => {
  const b = Random.getRandomBytes(8);
  return `${Date.now()}-${Array.from(b).map(n => n.toString(16).padStart(2, '0')).join('')}`;
};

type CategoriaItem = {
  id: number;
  nombre: string;
  productos_count?: number;
  stock_total?: number;
};

// 👇 lo que vamos a imprimir en ticket cuando hubo cambios
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

// 👇 lo que regresa el CambiosModal al guardar
type CambiosSaveResult = {
  rechazosIds?: number[];
  ticketItems?: CambioTicketItem[];
};

type MeResponse = {
  ventas_bloqueadas?: boolean;
  ventas_bloqueadas_motivo?: string | null;
  ventas_bloqueadas_cierre_id?: number | null;
};

export default function IniciarVenta() {
  const { cliente, cliente_id, resume } = useLocalSearchParams();
  const clienteSeleccionado = cliente ? JSON.parse(decodeURIComponent(cliente as string)) : null;

  const [clienteId, setClienteId] = useState<number | null>(
    cliente_id ? Number(cliente_id) : (clienteSeleccionado?.id ?? null)
  );

  const [productos, setProductos] = useState<any[]>([]);
  const [promociones, setPromociones] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [notaPago, setNotaPago] = useState('');
  const [venceStr, setVenceStr] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const [carrito, setCarrito] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Cambios (devueltos / rechazo)
  const [cambiosVenta, setCambiosVenta] = useState<any[]>([]);
  const [modalCambiosVisible, setModalCambiosVisible] = useState(false);

  const [cambiosTicket, setCambiosTicket] = useState<CambioTicketItem[]>([]);
  const [rechazosIds, setRechazosIds] = useState<number[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  // pagos
  const [esCredito, setEsCredito] = useState(false);
  const [pagoEfectivo, setPagoEfectivo] = useState<string>('');
  const [pagoTransfer, setPagoTransfer] = useState<string>('');
  const [pagoTarjeta, setPagoTarjeta] = useState<string>('');

  // idempotencia
  const [isSaving, setIsSaving] = useState(false);
  const [ventaIdParaCambios, setVentaIdParaCambios] = useState<number | null>(null); // ✅ venta_id para rechazos
  const [clientTxId, setClientTxId] = useState<string>(newClientTxId());

  // ✅ PREVENTA (ticket previo)
  const [isSavingPreventa, setIsSavingPreventa] = useState(false);
  const [preventaInfo, setPreventaInfo] = useState<{ id: number; folio: string } | null>(null);

  const justClosedRef = useRef(false);
  const inputBusquedaRef = useRef<TextInput>(null);
  const router = useRouter();

  // ======= Categorías (chips) =======
  const [categorias, setCategorias] = useState<CategoriaItem[]>([{ id: 0, nombre: 'Todas' }]);
  const [categoriaId, setCategoriaId] = useState<number>(0);
  const [loadingCats, setLoadingCats] = useState(false);

  // ======= Precio por cliente =======
  const priceForClient = (p: any) => Number(p?.precio_cliente ?? p?.precio ?? 0);
  const priceOfInventoryItemForClient = (invItem: any) =>
    Number(invItem?.producto?.precio_cliente ?? invItem?.producto?.precio ?? 0);

  // ======= Validación bloqueo /me =======
  const fetchMe = useCallback(async (): Promise<MeResponse | null> => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return null;

      const res = await fetch(`${API_BASE_URL}/api/me`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;

      const me: MeResponse = await res.json();
      return me;
    } catch {
      return null;
    }
  }, []);

  const assertVentasPermitidas = useCallback(async (): Promise<boolean> => {
    const me = await fetchMe();
    const blocked = Boolean(me?.ventas_bloqueadas);

    if (blocked) {
      const motivo = String(me?.ventas_bloqueadas_motivo ?? 'Ruta finalizada (pendiente de liberación por administrador)');
      const cierreId = me?.ventas_bloqueadas_cierre_id ? `\n\nCierre: #${me.ventas_bloqueadas_cierre_id}` : '';

      Alert.alert(
        'Ventas bloqueadas',
        `${motivo}${cierreId}\n\nPara vender de nuevo debes solicitarlo al administrador.`,
        [
          { text: 'Entendido', style: 'cancel', onPress: () => router.back() },
        ]
      );
      return false;
    }

    return true;
  }, [fetchMe, router]);

  // ======= Normalizar cambios para ticket (fallback) =======
  const normalizeCambiosForTicket = (items: any[]): CambioTicketItem[] => {
    if (!Array.isArray(items)) return [];
    return items.map((c: any) => ({
      producto: String(c?.producto ?? c?.nombre ?? 'Producto'),
      cantidad: Number(c?.cantidad ?? 0),
      motivo: c?.motivo ? String(c.motivo) : undefined,
      lote: c?.lote ?? null,
      fecha_caducidad: c?.fecha_caducidad ?? null,
      sustituciones: Array.isArray(c?.sustituciones)
        ? c.sustituciones.map((s: any) => ({
            producto: String(s?.producto ?? s?.nombre ?? 'Producto'),
            cantidad: Number(s?.cantidad ?? 0),
            lote: s?.lote ?? null,
            fecha_caducidad: s?.fecha_caducidad ?? null,
          }))
        : [],
    }));
  };

  // ======= Fetch inventario / promos =======
  const fetchInventario = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      const qsId = clienteId ?? clienteSeleccionado?.id;
      const clienteQS = qsId ? `?cliente_id=${qsId}` : '';
      const [invRes, promoRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/inventario${clienteQS}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/promociones${clienteQS}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        }),
      ]);

      const invData = await invRes.json();
      const promoData = await promoRes.json();

      setProductos(Array.isArray(invData) ? invData : []);
      setPromociones(Array.isArray(promoData?.promociones) ? promoData.promociones : []);
    } catch (error) {
      console.error('Error al obtener inventario/promociones:', error);
      setProductos([]);
      setPromociones([]);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchCategorias = async () => {
    const token = await AsyncStorage.getItem('authToken');
    try {
      setLoadingCats(true);
      const res = await fetch(`${API_BASE_URL}/api/categorias?solo_con_inventario=1`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCategorias(Array.isArray(data) ? data : [{ id: 0, nombre: 'Todas' }]);
    } catch (e) {
      console.error('Error categorias:', e);
      setCategorias([{ id: 0, nombre: 'Todas' }]);
    } finally {
      setLoadingCats(false);
    }
  };

  // ✅ FIX: useFocusEffect en lugar de useEffect para que el inventario
  // se recargue siempre al entrar, y el estado se limpie entre ventas.
  // Antes: al hacer una segunda venta seguida, el carrito/pagos de la
  // venta anterior podían quedar en memoria.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const ok = await assertVentasPermitidas();
        if (!ok) return;

        // ✅ Si NO es un resume de borrador, limpiar estado residual
        if (resume !== '1' && !justClosedRef.current) {
          setCarrito([]);
          setCambiosVenta([]);
          setCambiosTicket([]);
          setRechazosIds([]);
          setObservaciones('');
          setNotaPago('');
          setVenceStr('');
          setEsCredito(false);
          setPagoEfectivo('');
          setPagoTransfer('');
          setPagoTarjeta('');
          setClientTxId(newClientTxId());
        }

        fetchInventario();
        fetchCategorias();
      })();
    }, [resume])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInventario();
    fetchCategorias();
  }, []);

  const getPrecioProducto = (prodId: number) => {
    const inv = productos.find((i) => i.producto?.id === prodId || i.producto_id === prodId);
    return priceOfInventoryItemForClient(inv);
  };

  // ======= Borrador: crear / reanudar =======
  useEffect(() => {
    (async () => {
      const idFromParams =
        (cliente_id ? Number(cliente_id) : undefined) ??
        (clienteSeleccionado?.id ?? undefined);

      if (idFromParams && idFromParams > 0) setClienteId(idFromParams);

      if (resume === '1') {
        const draft = await getDraft();
        if (draft) {
          if (draft?.cliente?.id) setClienteId(Number(draft.cliente.id));
          setCarrito(draft.carrito || []);
          setObservaciones(draft.observaciones || '');
          setCambiosVenta(draft.cambiosVenta || []);
          setCambiosTicket(draft.cambiosTicket || []);
          setRechazosIds(draft.rechazosIds || []);
          if (draft.client_tx_id) setClientTxId(draft.client_tx_id);
          if (typeof draft.es_credito === 'boolean') setEsCredito(draft.es_credito);
          if (draft.pagos) {
            setPagoEfectivo(String(draft.pagos.efectivo ?? ''));
            setPagoTransfer(String(draft.pagos.transferencia ?? ''));
            setPagoTarjeta(String(draft.pagos.tarjeta ?? ''));
          }
          setNotaPago(draft.nota_pago || '');
          setVenceStr(draft.vence || '');
          setModalVisible(true);
        }
        return;
      }

      if (idFromParams && idFromParams > 0) {
        await setDraft({
          cliente: { id: idFromParams, nombre: clienteSeleccionado?.nombre ?? '' },
          carrito: [],
          observaciones: '',
          cambiosVenta: [],
          cambiosTicket: [],
          rechazosIds: [],
          startedAt: new Date().toISOString(),
          client_tx_id: clientTxId,
          es_credito: esCredito,
          pagos: { efectivo: '', transferencia: '', tarjeta: '' },
          nota_pago: '',
          vence: '',
          total: 0,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======= filtros =======
  const productosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return productos.filter((i) => {
      const nombre = (i.producto?.nombre || '').toLowerCase();
      const matchBusqueda = q === '' ? true : nombre.includes(q);

      if (categoriaId === 0) return matchBusqueda;

      const catId = Number(i.producto?.categoria?.id || 0);
      return matchBusqueda && catId === categoriaId;
    });
  }, [productos, busqueda, categoriaId]);

  const promocionesFiltradas = useMemo(
    () => promociones.filter((i) => (i.nombre || '').toLowerCase().includes(busqueda.toLowerCase())),
    [promociones, busqueda]
  );

  const totalProductosCount = carrito.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0);

  // ======= totales =======
  const subtotalProductos = carrito
    .filter((p) => p.producto_id && p.producto)
    .reduce((acc, p) => acc + Number(p.cantidad) * Number(priceForClient(p.producto)), 0);

  const subtotalPromos = carrito
    .filter((p) => p.promocion_id)
    .reduce((acc, p) => acc + Number(p.cantidad) * Number(p.precio_promocion || 0), 0);

  const ahorroPromos = carrito
    .filter((p) => p.promocion_id)
    .reduce((acc, p) => {
      const precioNormalPack = (p.productos || []).reduce(
        (s: number, sp: any) => s + Number(sp.precio || 0) * Number(sp?.pivot?.cantidad || 1),
        0
      );
      return acc + Number(p.cantidad) * Math.max(precioNormalPack - Number(p.precio_promocion || 0), 0);
    }, 0);

  const totalVenta = subtotalProductos + subtotalPromos;

  // ======= Pagos + Crédito confirmado =======
  const num = (s: string) => (s === '' ? 0 : Number(s));
  const pagosSuma = num(pagoEfectivo) + num(pagoTransfer) + num(pagoTarjeta);
  const saldoPendiente = Math.max(0, Number((totalVenta - pagosSuma).toFixed(2)));
  const excedente = Math.max(0, Number((pagosSuma - totalVenta).toFixed(2)));

  const esCreditoConfirmado = esCredito;

  const pagosValidos = esCreditoConfirmado
    ? pagosSuma <= totalVenta + 0.5
    : Math.abs(totalVenta - pagosSuma) <= 0.5;

  const requiereConfirmarCredito = saldoPendiente > 0.5 && !esCreditoConfirmado;

  // Prefill vence cuando es crédito confirmado
  useEffect(() => {
    if (esCreditoConfirmado) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(venceStr || '')) {
        setVenceStr(toYMD(addDays(new Date(), 7)));
      }
    } else {
      if (saldoPendiente <= 0.5) setVenceStr('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esCreditoConfirmado]);

  // ======= Autosave borrador =======
  useEffect(() => {
    (async () => {
      if (justClosedRef.current) return;

      if (!clienteId || clienteId <= 0) {
        await clearDraft();
        return;
      }

      const total = subtotalProductos + subtotalPromos;
      const isEmpty =
        carrito.length === 0 &&
        total === 0 &&
        !observaciones &&
        cambiosVenta.length === 0 &&
        !esCredito &&
        !pagoEfectivo && !pagoTransfer && !pagoTarjeta &&
        !notaPago && !venceStr;

      if (isEmpty) {
        await clearDraft();
        return;
      }

      await setDraft({
        cliente: { id: clienteId, nombre: clienteSeleccionado?.nombre ?? '' },
        carrito,
        observaciones,
        cambiosVenta,
        cambiosTicket,
        rechazosIds,
        startedAt: new Date().toISOString(),
        client_tx_id: clientTxId,
        es_credito: esCredito,
        pagos: { efectivo: pagoEfectivo, transferencia: pagoTransfer, tarjeta: pagoTarjeta },
        nota_pago: notaPago,
        vence: venceStr,
        total,
      });
    })();
  }, [
    clienteId, carrito, observaciones, cambiosVenta, cambiosTicket, rechazosIds,
    esCredito, pagoEfectivo, pagoTransfer, pagoTarjeta, clientTxId, notaPago,
    venceStr, subtotalProductos, subtotalPromos
  ]);

  useEffect(() => {
    if (preventaInfo) setPreventaInfo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrito, observaciones, esCreditoConfirmado, pagoEfectivo, pagoTransfer, pagoTarjeta, notaPago, venceStr]);

  // ======= Carrito =======
  const agregarProducto = (producto: any) => {
    if (producto.isPromo) {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.promocion_id === producto.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            promocion_id: producto.id,
            nombre_promocion: producto.nombre,
            cantidad: 1,
            precio_promocion: Number(producto.precio),
            productos: (producto.productos || []).map((sp: any) => ({
              ...sp,
              precio: Number(sp?.precio_cliente ?? sp?.precio ?? getPrecioProducto(sp.id) ?? 0),
              pivot: sp.pivot,
            })),
          },
        ];
      });
    } else {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.producto_id === producto.producto_id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
          return copy;
        }
        return [
          ...prev,
          {
            ...producto,
            cantidad: 1,
            producto: { ...producto.producto, precio: priceOfInventoryItemForClient(producto) },
          },
        ];
      });
    }
  };

  const quitarProducto = (producto: any) => {
    if (producto.isPromo) {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.promocion_id === producto.id);
        if (idx < 0) return prev;
        const copy = [...prev];
        if (copy[idx].cantidad <= 1) return copy.filter((_, i) => i !== idx);
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad - 1 };
        return copy;
      });
    } else {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.producto_id === producto.producto_id);
        if (idx < 0) return prev;
        const copy = [...prev];
        if (copy[idx].cantidad <= 1) return copy.filter((_, i) => i !== idx);
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad - 1 };
        return copy;
      });
    }
  };

  const setCantidadDirecta = (producto: any, value: string) => {
    const n = value.replace(/[^\d]/g, '');
    if (producto.isPromo) {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.promocion_id === producto.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: n === '' ? 0 : Number(n) };
          return copy;
        }
        if (n === '' || Number(n) <= 0) return prev;
        return [
          ...prev,
          {
            promocion_id: producto.id,
            nombre_promocion: producto.nombre,
            cantidad: Number(n),
            precio_promocion: Number(producto.precio),
            productos: (producto.productos || []).map((sp: any) => ({
              ...sp,
              precio: Number(sp?.precio_cliente ?? sp?.precio ?? getPrecioProducto(sp.id) ?? 0),
              pivot: sp.pivot,
            })),
          },
        ];
      });
    } else {
      setCarrito((prev) => {
        const idx = prev.findIndex((p) => p.producto_id === producto.producto_id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], cantidad: n === '' ? 0 : Number(n) };
          return copy;
        }
        if (n === '' || Number(n) <= 0) return prev;
        return [
          ...prev,
          {
            ...producto,
            cantidad: Number(n),
            producto: { ...producto.producto, precio: priceOfInventoryItemForClient(producto) },
          },
        ];
      });
    }
  };

  // ======= Metodo pago para ticket =======
  const metodoPagoForTicket = () => {
    const arr = [
      { k: 'efectivo', v: num(pagoEfectivo) },
      { k: 'transferencia', v: num(pagoTransfer) },
      { k: 'tarjeta', v: num(pagoTarjeta) },
    ].filter(x => x.v > 0);

    if (esCreditoConfirmado && arr.length === 0) return 'crédito';
    if (arr.length === 0) return 'efectivo';
    if (arr.length === 1) return arr[0].k;
    return 'mixto';
  };

  // ======= POST venta =======
  const confirmarVenta = async (rechazosToSend: number[] = []) => {
    // ✅ validación anti bypass (por si quedó en esta pantalla)
    const ok = await assertVentasPermitidas();
    if (!ok) return null;

    if (isSaving) return null;
    setIsSaving(true);

    try {
      if (!clienteId || clienteId <= 0) {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Venta sin cliente',
          text2: 'No se encontró el cliente de la venta.',
        });
        return null;
      }

      const token = await AsyncStorage.getItem('authToken');

      const productosPayload = carrito
        .filter((p) => p.producto_id && p.cantidad > 0)
        .map((p) => ({
          producto_id: p.producto_id,
          cantidad: Number(p.cantidad),
          precio_unitario: Number(priceForClient(p.producto)),
          lote: p.lote ?? null,
          fecha_caducidad: p.fecha_caducidad ?? null,
        }));

      const promocionesPayload = carrito
        .filter((p) => p.promocion_id && p.cantidad > 0)
        .map((p) => ({
          promocion_id: p.promocion_id,
          cantidad: Number(p.cantidad),
        }));

      const pagosPayload = [
        { metodo: 'efectivo', monto: Number(pagoEfectivo || 0) },
        { metodo: 'transferencia', monto: Number(pagoTransfer || 0) },
        { metodo: 'tarjeta', monto: Number(pagoTarjeta || 0) },
      ].filter((x) => x.monto > 0);

      const body: any = {
        cliente_id: clienteId,
        observaciones,
        productos: productosPayload,
        promociones: promocionesPayload,
        es_credito: esCreditoConfirmado,
        pagos: pagosPayload,
        client_tx_id: clientTxId,
        rechazos_ids: rechazosToSend,
        preventa_id: preventaInfo?.id ?? null,
      };

      if (/^\d{4}-\d{2}-\d{2}$/.test(venceStr)) body.fecha_vencimiento = venceStr;
      if (notaPago.trim() !== '') body.nota_pago = notaPago.trim();

      const response = await fetch(`${API_BASE_URL}/api/venta`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'Error al guardar venta',
          text2: data?.message || 'Ocurrió un error',
        });
        return null;
      }

      if (data?.warning) {
        Toast.show({
          type: 'info',
          position: 'top',
          text1: 'Aviso',
          text2: String(data.warning),
        });
      }

      return {
        venta_id: data?.venta_id,
        total: Number(data?.total ?? totalVenta),
        pagado: Number(data?.pagado ?? pagosSuma),
        saldo_pendiente: Number(data?.saldo_pendiente ?? saldoPendiente),
        estado: String(data?.estado ?? (esCreditoConfirmado ? 'credito' : 'pagada')),
      };
    } catch (e: any) {
      Toast.show({
        type: 'error',
        position: 'top',
        text1: 'Fallo de red',
        text2: String(e?.message || e),
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // ======= POST preventa (ticket previo) =======
  const crearPreventa = async () => {
    // ✅ también aplica bloqueo aquí
    const ok = await assertVentasPermitidas();
    if (!ok) return;

    if (isSavingPreventa) return;

    try {
      setIsSavingPreventa(true);

      if (!clienteId || clienteId <= 0) {
        Alert.alert('Preventa', 'No se encontró el cliente.');
        return;
      }

      const token = await AsyncStorage.getItem('authToken');

      const productosPayload = carrito
        .filter((p) => p.producto_id && p.cantidad > 0)
        .map((p) => ({
          producto_id: p.producto_id,
          cantidad: Number(p.cantidad),
          lote: p.lote ?? null,                         // ✅ agregar lote
          fecha_caducidad: p.fecha_caducidad ?? null,   // ✅ agregar caducidad
        }));

      const promocionesPayload = carrito
        .filter((p) => p.promocion_id && p.cantidad > 0)
        .map((p) => ({
          promocion_id: p.promocion_id,
          cantidad: Number(p.cantidad),
        }));

      const pagosPayload = [
        { metodo: 'efectivo', monto: Number(pagoEfectivo || 0) },
        { metodo: 'transferencia', monto: Number(pagoTransfer || 0), referencia: notaPago?.trim() ? notaPago.trim() : null },
        { metodo: 'tarjeta', monto: Number(pagoTarjeta || 0) },
      ].filter((x) => x.monto > 0);

      const body: any = {
        cliente_id: clienteId,
        observaciones,
        productos: productosPayload,
        promociones: promocionesPayload,
        es_credito: esCreditoConfirmado,
        pagos: pagosPayload,
        rechazos_ids: rechazosIds ?? [],
        client_tx_id: `pv-${newClientTxId()}`,
      };

      if (/^\d{4}-\d{2}-\d{2}$/.test(venceStr)) body.fecha_vencimiento = venceStr;

      const response = await fetch(`${API_BASE_URL}/api/preventas`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error al crear ticket previo', data?.message || 'Ocurrió un error');
        return;
      }

      setPreventaInfo({ id: Number(data.preventa_id), folio: String(data.folio) });

      Toast.show({
        type: 'success',
        position: 'top',
        text1: 'Ticket previo generado',
        text2: String(data.folio),
      });
    } catch (e: any) {
      Alert.alert('Error', String(e?.message || e));
    } finally {
      setIsSavingPreventa(false);
    }
  };

  const finalizarVenta = async (cambiosParaTicket: CambioTicketItem[] = [], rechazos: number[] = []) => {
    const result = await confirmarVenta(rechazos);
    if (!result) return;

    justClosedRef.current = true;
    await clearDraft();

    const carritoConCategoria = carrito.map(item => {
      if (item.producto_id && item.producto) {
        return {
          ...item,
          producto: { ...item.producto, categoria: item.producto.categoria || null },
        };
      }
      return item;
    });

    // reset
    setCarrito([]);
    setCambiosVenta([]);
    setCambiosTicket([]);
    setRechazosIds([]);
    setObservaciones('');
    setNotaPago('');
    setVenceStr('');
    setEsCredito(false);
    setPagoEfectivo('');
    setPagoTransfer('');
    setPagoTarjeta('');
    setModalVisible(false);
    setModalCambiosVisible(false);

    setClientTxId(newClientTxId());
    fetchInventario();

    router.push({
      pathname: '/ticket',
      params: {
        cliente: JSON.stringify(clienteSeleccionado),
        productos: JSON.stringify(carritoConCategoria),
        cambios: JSON.stringify(cambiosParaTicket || []),
        rechazos_ids: JSON.stringify(rechazos || []),
        total: String(Number(result.total ?? totalVenta).toFixed(2)),
        observaciones,
        fecha: new Date().toISOString(),
        metodo_pago: metodoPagoForTicket(),
        es_credito: String(esCreditoConfirmado),
        estado: result.estado,
        total_pagado: String(result.pagado ?? pagosSuma),
        saldo_pendiente: String(result.saldo_pendiente ?? saldoPendiente),
        fecha_vencimiento: venceStr || '',
        nota_pago: notaPago || '',
        cliente_id: String(clienteId ?? ''),
      },
    });

    setTimeout(() => {
      justClosedRef.current = false;
    }, 1000);
  };


  // ✅ Navegar al ticket cuando ya hubo cambios registrados (venta ya creada)
  const navegarAlTicketConCambios = async (ticketItems: CambioTicketItem[], ids: number[]) => {
    justClosedRef.current = true;
    await clearDraft();

    const carritoConCategoria = carrito.map(item => {
      if (item.producto_id && item.producto) {
        return { ...item, producto: { ...item.producto, categoria: item.producto.categoria || null } };
      }
      return item;
    });

    setCarrito([]);
    setCambiosVenta([]);
    setCambiosTicket([]);
    setRechazosIds([]);
    setObservaciones('');
    setNotaPago('');
    setVenceStr('');
    setEsCredito(false);
    setPagoEfectivo('');
    setPagoTransfer('');
    setPagoTarjeta('');
    setModalVisible(false);
    setClientTxId(newClientTxId());
    fetchInventario();

    router.push({
      pathname: '/ticket',
      params: {
        cliente: JSON.stringify(clienteSeleccionado),
        productos: JSON.stringify(carritoConCategoria),
        cambios: JSON.stringify(ticketItems || []),
        rechazos_ids: JSON.stringify(ids || []),
        total: String(Number(totalVenta).toFixed(2)),
        observaciones,
        fecha: new Date().toISOString(),
        metodo_pago: metodoPagoForTicket(),
        es_credito: String(esCreditoConfirmado),
        estado: esCreditoConfirmado ? 'credito' : 'pagada',
        total_pagado: String(pagosSuma),
        saldo_pendiente: String(saldoPendiente),
        fecha_vencimiento: venceStr || '',
        nota_pago: notaPago || '',
        cliente_id: String(clienteId ?? ''),
      },
    });

    setTimeout(() => { justClosedRef.current = false; }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>
        Venta para: {clienteSeleccionado?.nombre || (clienteId ? `#${clienteId}` : '')}
      </Text>

      {/* Busqueda */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          ref={inputBusquedaRef}
          style={styles.input}
          placeholder="Buscar producto..."
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {busqueda !== '' && (
          <TouchableOpacity onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips categorías */}
      <View style={styles.chipsWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categorias}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ gap: 8, paddingRight: 6 }}
          renderItem={({ item: c }) => {
            const active = categoriaId === c.id;
            return (
              <TouchableOpacity
                onPress={() => setCategoriaId(c.id)}
                style={[
                  styles.chip,
                  active && { backgroundColor: Colors.light.primario, borderColor: Colors.light.primario },
                ]}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>
                  {c.nombre}
                </Text>

                {typeof c.productos_count === 'number' && c.id !== 0 && (
                  <View style={[styles.chipBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Text style={[styles.chipBadgeText, active && { color: '#fff' }]}>
                      {c.productos_count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            loadingCats ? (
              <View style={{ paddingHorizontal: 8, justifyContent: 'center' }}>
                <Text style={{ color: '#6B7280', fontWeight: '700' }}>Cargando…</Text>
              </View>
            ) : null
          }
        />
      </View>

      {/* Lista */}
      <FlatList
        data={[...promocionesFiltradas.map((p) => ({ ...p, isPromo: true })), ...productosFiltrados]}
        keyExtractor={(item: any, index) => (item?.isPromo ? `promo-${item.id}` : `inv-${item?.producto_id ?? index}`)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.primario]}
            tintColor={Colors.light.primario}
          />
        }
        renderItem={({ item }: any) => {
          const cantidadActual = item.isPromo
            ? carrito.find((p) => p.promocion_id === item.id)?.cantidad || 0
            : carrito.find((p) => p.producto_id === item.producto_id)?.cantidad || 0;

          const CantidadEditor = (
            <View style={styles.qtyRow}>
              <TouchableOpacity onPress={() => quitarProducto(item)}>
                <Ionicons name="remove-circle-outline" size={26} color={Colors.light.primario} />
              </TouchableOpacity>

              <TextInput
                style={styles.qtyInput}
                keyboardType="number-pad"
                value={String(cantidadActual)}
                onChangeText={(v) => setCantidadDirecta(item, v)}
                onBlur={() => {
                  const val = Number(cantidadActual || 0);
                  if (isNaN(val) || val < 0) setCantidadDirecta(item, '0');
                }}
                maxLength={5}
              />

              <TouchableOpacity onPress={() => agregarProducto(item)}>
                <Ionicons name="add-circle-outline" size={26} color={Colors.light.primario} />
              </TouchableOpacity>
            </View>
          );

          if (item.isPromo) {
            return (
              <View style={[styles.card, { borderLeftColor: Colors.light.primario, borderLeftWidth: 4 }]}>
                <Text style={[styles.nombre, { color: 'purple' }]} numberOfLines={2}>
                  🔥 Promoción: {item.nombre}
                </Text>
                {!!item.descripcion && <Text style={styles.small}>📋 {item.descripcion}</Text>}
                <Text style={styles.small}>💰 Precio Promo: {money(item.precio)}</Text>
                <Text style={styles.small}>🕒 {item.fecha_inicio} a {item.fecha_fin}</Text>
                <Text style={[styles.small, { marginTop: 6 }]}>Incluye:</Text>
                {item.productos?.map((prod: any, idx: number) => (
                  <Text key={idx} style={styles.small}>• {prod.nombre} (x{prod.pivot?.cantidad})</Text>
                ))}
                {CantidadEditor}
              </View>
            );
          }

          return (
            <View style={styles.card}>
              {item.producto?.imagen_url && (
                <Image source={{ uri: item.producto.imagen_url }} style={styles.imagen} resizeMode="contain" />
              )}

              <Text style={styles.nombre} numberOfLines={2}>
                <Ionicons name="pricetag-outline" /> {item.producto?.nombre}
              </Text>

              {!!item.producto?.categoria?.nombre && (
                <Text style={styles.catLine}>🏷️ {item.producto.categoria.nombre}</Text>
              )}

              <Text style={styles.small}><Ionicons name="cube-outline" /> Cantidad: {item.cantidad}</Text>
              <Text style={styles.small}><Ionicons name="calendar-outline" /> Caduca: {item.fecha_caducidad || 'N/D'}</Text>
              <Text style={styles.small}><Ionicons name="cash-outline" /> Precio: {money(priceOfInventoryItemForClient(item))}</Text>
              {CantidadEditor}
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Botón carrito */}
      <TouchableOpacity
        style={styles.carritoBtn}
        onPress={async () => {
          setModalVisible(true);
          await setDraft({
            cliente: clienteId ? { id: clienteId, nombre: clienteSeleccionado?.nombre ?? '' } : clienteSeleccionado,
            carrito,
            observaciones,
            cambiosVenta,
            cambiosTicket,
            rechazosIds,
            startedAt: new Date().toISOString(),
            client_tx_id: clientTxId,
            es_credito: esCredito,
            pagos: { efectivo: pagoEfectivo, transferencia: pagoTransfer, tarjeta: pagoTarjeta },
            nota_pago: notaPago,
            vence: venceStr,
            total: subtotalProductos + subtotalPromos,
          });
        }}
      >
        <Ionicons name="cart-outline" size={28} color="#fff" />
        {totalProductosCount > 0 && <Text style={styles.badge}>{totalProductosCount}</Text>}
      </TouchableOpacity>

      {/* Modal resumén */}
      <ResumenVentaModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        carrito={carrito}
        money={money}
        priceForClient={priceForClient}
        subtotalProductos={subtotalProductos}
        subtotalPromos={subtotalPromos}
        ahorroPromos={ahorroPromos}
        totalVenta={totalVenta}
        observaciones={observaciones}
        setObservaciones={setObservaciones}
        pagoEfectivo={pagoEfectivo}
        setPagoEfectivo={setPagoEfectivo}
        pagoTransfer={pagoTransfer}
        setPagoTransfer={setPagoTransfer}
        pagoTarjeta={pagoTarjeta}
        setPagoTarjeta={setPagoTarjeta}
        notaPago={notaPago}
        setNotaPago={setNotaPago}
        venceStr={venceStr}
        setVenceStr={setVenceStr}
        showPicker={showPicker}
        setShowPicker={setShowPicker}
        addDays={addDays}
        toYMD={toYMD}
        esCreditoConfirmado={esCreditoConfirmado}
        onToggleCredito={() => {
          if (!esCreditoConfirmado) {
            Alert.alert(
              'Confirmar venta a crédito',
              'Esta venta quedará con saldo pendiente. ¿Deseas continuar como crédito?',
              [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Sí, a crédito',
                  onPress: () => {
                    setEsCredito(true);
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(venceStr || '')) {
                      setVenceStr(toYMD(addDays(new Date(), 7)));
                    }
                  },
                },
              ]
            );
          } else {
            setEsCredito(false);
            setVenceStr('');
          }
        }}
        pagosSuma={pagosSuma}
        saldoPendiente={saldoPendiente}
        excedente={excedente}
        requiereConfirmarCredito={requiereConfirmarCredito}
        pagosValidos={pagosValidos}
        isSaving={isSaving}
        onConfirmar={() => {
          Alert.alert(
            '¿Recibiste producto en cambio?',
            'El cliente devolvió productos por caducidad o no vendidos.',
            [
              {
                text: 'NO',
                onPress: async () => {
                  setCambiosTicket([]);
                  setRechazosIds([]);
                  await finalizarVenta([], []);
                },
                style: 'cancel'
              },
              {
                text: 'SÍ',
                onPress: async () => {
                  // ✅ Crear la venta PRIMERO para obtener el venta_id
                  // Los rechazos se registran después en el CambiosModal con ese id
                  const result = await confirmarVenta([]);
                  if (!result) return; // si falló la venta, no abrir modal

                  setVentaIdParaCambios(result.venta_id ?? null); // guardar venta_id
                  setCambiosVenta([]);
                  setCambiosTicket([]);
                  setRechazosIds([]);
                  setModalCambiosVisible(true);
                  setModalVisible(false);
                },
              },
            ]
          );
        }}
        onDescartar={() =>
          Alert.alert('Cancelar venta', '¿Deseas descartar esta venta?', [
            { text: 'No', style: 'cancel' },
            {
              text: 'Sí, descartar',
              style: 'destructive',
              onPress: async () => { await clearDraft(); router.back(); },
            },
          ])
        }
        onCrearPreventa={crearPreventa}
        preventaInfo={preventaInfo}
        isSavingPreventa={isSavingPreventa}
        onVerTicketPrevio={() => {
          if (!preventaInfo?.id) return;
          router.push({
            pathname: '/TicketPrevio',
            params: { preventa_id: String(preventaInfo.id) },
          });
        }}
      />

      {/* Modal de cambios */}
      <CambiosModal
        visible={modalCambiosVisible}
        productos={productos}
        cambiosVenta={cambiosVenta}
        setCambiosVenta={setCambiosVenta}
        ventaId={ventaIdParaCambios}
        onConfirmar={async (res?: CambiosSaveResult) => {
          // ✅ La venta ya fue creada antes de abrir este modal
          // Solo navegamos al ticket con los cambios registrados
          const ticketItems = (res?.ticketItems && Array.isArray(res.ticketItems))
            ? res.ticketItems
            : normalizeCambiosForTicket(cambiosVenta);

          const ids = (res?.rechazosIds && Array.isArray(res.rechazosIds))
            ? res.rechazosIds
            : [];

          setCambiosTicket(ticketItems);
          setRechazosIds(ids);
          setModalCambiosVisible(false);

          // Navegar al ticket sin crear venta de nuevo
          await navegarAlTicketConCambios(ticketItems, ids);
        }}
        onClose={() => setModalCambiosVisible(false)}
      />

      <Toast topOffset={60} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#F3F4F6' },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center', color: Colors.light.primario },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F2F2F2', borderRadius: 12, paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10
  },
  input: { flex: 1, height: 44, color: '#111827' },

  // chips
  chipsWrap: { marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: { fontWeight: '800', fontSize: 12, color: '#111827' },
  chipBadge: {
    minWidth: 22,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeText: { fontSize: 11, fontWeight: '800', color: '#374151' },

  card: {
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  nombre: { fontWeight: '700', marginBottom: 4, color: '#111827' },
  small: { color: '#374151', marginTop: 2 },
  catLine: { marginTop: 2, fontWeight: '700', color: '#6B7280' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  qtyInput: {
    minWidth: 52, paddingHorizontal: 10, height: 36, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, textAlign: 'center', color: '#111827'
  },

  imagen: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8 },

  carritoBtn: {
    position: 'absolute', bottom: 30, right: 20,
    backgroundColor: Colors.light.primario, borderRadius: 30, padding: 14, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: 'red', color: '#fff',
    fontSize: 12, borderRadius: 10, paddingHorizontal: 6,
  },
});