// hooks/useVentas.ts
// ✅ FIX: Sin cambios estructurales aquí — los cambios se cargan
// directamente en SaleModal al abrir cada venta (lazy loading).
// Solo se asegura que la API incluya los campos necesarios.

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/constants/Config';

export function useVentas(clienteId?: number) {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [fechaInicio, setFechaInicio] = useState<Date | null>(null);
  const [fechaFin, setFechaFin] = useState<Date | null>(null);
  const [producto, setProducto] = useState('');

  const fetchVentas = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/clientes/${clienteId}/ventas`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVentas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error al cargar ventas:', e);
      setVentas([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clienteId]);

  useEffect(() => {
    setVentas([]);
    setFechaInicio(null);
    setFechaFin(null);
    setProducto('');
    if (clienteId) fetchVentas();
  }, [clienteId, fetchVentas]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVentas();
  }, [fetchVentas]);

  const aplicarFiltros = useMemo(() => {
    const filtered = ventas.filter((v: any) => {
      const fecha = new Date(v.fecha);
      const inRange =
        (!fechaInicio || fecha >= new Date(fechaInicio)) &&
        (!fechaFin || fecha <= new Date(fechaFin));
      const hasProd =
        producto === '' ||
        v.detalles?.some((d: any) =>
          (d.producto?.nombre || '').toLowerCase().includes(producto.toLowerCase())
        );
      return inRange && hasProd;
    });
    return filtered.sort((a: any, b: any) =>
      new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }, [ventas, fechaInicio, fechaFin, producto]);

  const resumen = useMemo(() => {
    const totalVentas = aplicarFiltros.length;
    const suma = aplicarFiltros.reduce((acc: number, v: any) => acc + Number(v.total || 0), 0);
    const avg = totalVentas ? suma / totalVentas : 0;
    return { totalVentas, suma, avg };
  }, [aplicarFiltros]);

  const limpiarFiltros = () => {
    setFechaInicio(null);
    setFechaFin(null);
    setProducto('');
  };

  const rangoRapido = (dias: number) => {
    const fin = new Date();
    const ini = new Date();
    ini.setDate(fin.getDate() - (dias - 1));
    setFechaInicio(ini);
    setFechaFin(fin);
  };

  return {
    ventas: aplicarFiltros,
    loading, refreshing, onRefresh,
    fechaInicio, setFechaInicio,
    fechaFin, setFechaFin,
    producto, setProducto,
    limpiarFiltros, rangoRapido,
    resumen,
  };
}