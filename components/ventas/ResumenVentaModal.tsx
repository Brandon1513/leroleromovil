import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

let DateTimePicker: any;
try {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch { /* no-op */ }

type Props = {
  visible: boolean;
  onClose: () => void;

  carrito: any[];
  money: (n: number) => string;
  priceForClient: (p: any) => number;

  subtotalProductos: number;
  subtotalPromos: number;
  ahorroPromos: number;
  totalVenta: number;

  observaciones: string;
  setObservaciones: (v: string) => void;

  pagoEfectivo: string;
  setPagoEfectivo: (v: string) => void;
  pagoTransfer: string;
  setPagoTransfer: (v: string) => void;
  pagoTarjeta: string;
  setPagoTarjeta: (v: string) => void;

  notaPago: string;
  setNotaPago: (v: string) => void;

  venceStr: string;
  setVenceStr: (v: string) => void;

  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  addDays: (d: Date, n: number) => Date;
  toYMD: (d: Date) => string;

  esCreditoConfirmado: boolean;
  onToggleCredito: () => void;

  pagosSuma: number;
  saldoPendiente: number;
  excedente: number;
  requiereConfirmarCredito: boolean;

  pagosValidos: boolean;
  isSaving: boolean;

  onConfirmar: () => void;
  onDescartar: () => void;

  // ✅ PREVENTA / Ticket previo
  onCrearPreventa: () => Promise<void> | void;
  preventaInfo?: { id: number; folio: string } | null;
  isSavingPreventa?: boolean;
  onVerTicketPrevio?: () => void;
};

export default function ResumenVentaModal(props: Props) {
  const {
    visible, onClose,
    carrito, money, priceForClient,
    subtotalProductos, subtotalPromos, ahorroPromos, totalVenta,
    observaciones, setObservaciones,
    pagoEfectivo, setPagoEfectivo,
    pagoTransfer, setPagoTransfer,
    pagoTarjeta, setPagoTarjeta,
    notaPago, setNotaPago,
    venceStr, setVenceStr,
    showPicker, setShowPicker,
    addDays, toYMD,
    esCreditoConfirmado, onToggleCredito,
    pagosSuma, saldoPendiente, excedente, requiereConfirmarCredito,
    pagosValidos, isSaving,
    onConfirmar, onDescartar,

    onCrearPreventa,
    preventaInfo = null,
    isSavingPreventa = false,
    onVerTicketPrevio,
  } = props;

  const num = (s: string) => (s === '' ? 0 : Number(s));
  const transferenciaMonto = num(pagoTransfer);

  // ✅ Solo mostrar referencia si hay transferencia (>0)
  const mostrarReferencia = transferenciaMonto > 0;

  // ✅ Solo mostrar vence si es crédito
  const mostrarVence = esCreditoConfirmado;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}
      >
        <View style={{ backgroundColor: 'white', padding: 16, borderTopRightRadius: 16, borderTopLeftRadius: 16, elevation: 6, maxHeight: '92%' }}>
          <Text style={{ fontWeight: '800', fontSize: 18, marginBottom: 10, color: Colors.light.primario }}>
            🧾 Resumen de venta
          </Text>

          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {carrito.length === 0 ? (
              <Text>No hay productos aún.</Text>
            ) : (
              <View>
                {carrito.map((p, index) => {
                  if (p.producto_id && p.producto) {
                    return (
                      <View key={`prod-${index}`} style={{ marginBottom: 6 }}>
                        <Text numberOfLines={2}>
                          {p.producto.nombre} x {p.cantidad} = {money(p.cantidad * Number(priceForClient(p.producto)))}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 12 }}>
                          Lote: {p.lote || 'N/D'} · Caduca: {p.fecha_caducidad || 'N/D'}
                        </Text>
                      </View>
                    );
                  }
                  if (p.promocion_id) {
                    return (
                      <View key={`promo-${index}`} style={{ marginBottom: 6 }}>
                        <Text style={{ fontWeight: 'bold', color: Colors.light.primario }} numberOfLines={2}>
                          🎁 {p.nombre_promocion || 'Promoción'} x {p.cantidad} = {money(p.cantidad * Number(p.precio_promocion))}
                        </Text>
                        {p.productos?.map((sp: any, j: number) => (
                          <Text key={j} style={{ fontSize: 12, color: '#6B7280', marginLeft: 12 }}>
                            • {sp.nombre} (x{(sp?.pivot?.cantidad ?? 1) * p.cantidad})
                          </Text>
                        ))}
                      </View>
                    );
                  }
                  return null;
                })}

                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: 'bold' }}>Subtotal productos: {money(subtotalProductos)}</Text>
                  <Text style={{ fontWeight: 'bold' }}>Subtotal promociones: {money(subtotalPromos)}</Text>
                  <Text style={{ fontWeight: 'bold', color: 'green' }}>Ahorro por promociones: -{money(ahorroPromos)}</Text>
                  <Text style={{ marginTop: 6, fontWeight: 'bold', color: Colors.light.primario }}>
                    Total: {money(totalVenta)}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              style={{ marginTop: 16, height: 44, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12 }}
              placeholder="Observaciones (opcional)"
              value={observaciones}
              onChangeText={setObservaciones}
            />

            <View style={{ marginTop: 16, padding: 12, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: '#111827' }}>Método(s) de pago</Text>

                <TouchableOpacity
                  onPress={() => {
                    if (!esCreditoConfirmado) {
                      Alert.alert(
                        'Confirmar venta a crédito',
                        'Esta venta quedará con saldo pendiente. ¿Deseas continuar como crédito?',
                        [
                          { text: 'No', style: 'cancel' },
                          { text: 'Sí, a crédito', onPress: onToggleCredito },
                        ]
                      );
                    } else {
                      onToggleCredito();
                    }
                  }}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#D1D5DB' },
                    esCreditoConfirmado && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                  ]}
                >
                  <Ionicons name="time-outline" size={14} color={esCreditoConfirmado ? '#991B1B' : '#374151'} />
                  <Text style={{ fontWeight: '700', fontSize: 12, color: esCreditoConfirmado ? '#991B1B' : '#111827' }}>
                    {esCreditoConfirmado ? 'Venta a crédito' : 'Contado'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inputs pago */}
              {[
                { label: 'Efectivo', value: pagoEfectivo, onChange: setPagoEfectivo },
                { label: 'Transferencia', value: pagoTransfer, onChange: setPagoTransfer },
                { label: 'Tarjeta', value: pagoTarjeta, onChange: setPagoTarjeta },
              ].map((r) => (
                <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={{ color: '#111827' }}>{r.label}</Text>
                  <TextInput
                    style={{ width: 160, height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, textAlign: 'right', color: '#111827' }}
                    placeholder="$0.00"
                    keyboardType="decimal-pad"
                    value={r.value}
                    onChangeText={r.onChange}
                  />
                </View>
              ))}

              {/* ✅ Referencia SOLO si hay transferencia */}
              {mostrarReferencia && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={{ color: '#111827' }}>Referencia</Text>
                  <TextInput
                    style={{ width: 160, height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, textAlign: 'right', color: '#111827' }}
                    placeholder="(opcional)"
                    value={notaPago}
                    onChangeText={setNotaPago}
                  />
                </View>
              )}

              {/* ✅ Vence SOLO si es crédito */}
              {mostrarVence && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={{ color: '#111827' }}>Vence</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        style={{ width: 130, height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 10, textAlign: 'right', color: '#111827' }}
                        placeholder="YYYY-MM-DD"
                        value={venceStr}
                        onChangeText={setVenceStr}
                      />
                      {DateTimePicker && (
                        <TouchableOpacity onPress={() => setShowPicker(true)}>
                          <Ionicons name="calendar-outline" size={22} color={Colors.light.primario} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {showPicker && DateTimePicker && (
                    <DateTimePicker
                      value={/^\d{4}-\d{2}-\d{2}$/.test(venceStr) ? new Date(venceStr) : addDays(new Date(), 7)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={(_, date) => {
                        setShowPicker(Platform.OS === 'ios');
                        if (date) setVenceStr(toYMD(date));
                      }}
                    />
                  )}
                </>
              )}

              {/* Summary */}
              <View style={{ marginTop: 10, gap: 4 }}>
                <Text style={{ fontWeight: '700' }}>Pagado: {money(pagosSuma)}</Text>

                {excedente > 0 && (
                  <Text style={{ fontWeight: '700', color: '#991B1B' }}>Excedente: {money(excedente)}</Text>
                )}

                {saldoPendiente > 0.5 ? (
                  <Text style={{ fontWeight: '700', color: '#B45309' }}>
                    Saldo pendiente: {money(saldoPendiente)}
                  </Text>
                ) : (
                  <Text style={{ fontWeight: '700', color: '#065F46' }}>Pagado completo</Text>
                )}

                {requiereConfirmarCredito && (
                  <Text style={{ marginTop: 6, color: '#991B1B', fontWeight: '800' }}>
                    ⚠️ Hay saldo pendiente. Activa “Venta a crédito” para continuar.
                  </Text>
                )}
              </View>
            </View>

            {/* ✅ Ticket previo / Preventa */}
            <View style={{ marginTop: 12, gap: 8 }}>
              {!preventaInfo ? (
                <TouchableOpacity
                  style={[
                    { backgroundColor: '#111827', padding: 12, borderRadius: 10, alignItems: 'center' },
                    (carrito.length === 0 || isSaving || isSavingPreventa) && { opacity: 0.5 },
                  ]}
                  disabled={carrito.length === 0 || isSaving || isSavingPreventa}
                  onPress={() => {
                    Alert.alert(
                      'Ticket previo',
                      'Se generará un ticket previo (preventa) con el resumen actual. ¿Continuar?',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Sí, generar', onPress: () => onCrearPreventa() },
                      ]
                    );
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {isSavingPreventa ? 'Generando ticket…' : '🧾 Generar Ticket Previo'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}>
                  <Text style={{ fontWeight: '800', color: '#111827' }}>✅ Ticket previo generado</Text>
                  <Text style={{ marginTop: 4, color: '#374151' }}>
                    Folio: <Text style={{ fontWeight: '800' }}>{preventaInfo.folio}</Text> · ID: {preventaInfo.id}
                  </Text>

                  {!!onVerTicketPrevio && (
                    <TouchableOpacity
                      style={{ marginTop: 10, backgroundColor: Colors.light.primario, padding: 10, borderRadius: 10, alignItems: 'center' }}
                      onPress={onVerTicketPrevio}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800' }}>🖨️ Ver / Imprimir Ticket Previo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[
              { marginTop: 12, backgroundColor: Colors.light.primario, padding: 14, borderRadius: 10, alignItems: 'center' },
              (carrito.length === 0 || !pagosValidos || isSaving || requiereConfirmarCredito) && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (requiereConfirmarCredito) {
                Alert.alert('Confirmación requerida', 'Hay saldo pendiente. Debes activar “Venta a crédito” para continuar.');
                return;
              }
              if (!pagosValidos) {
                Alert.alert(
                  'Revisa los pagos',
                  esCreditoConfirmado
                    ? 'En crédito, el anticipo no puede exceder el total.'
                    : 'En contado, la suma debe cubrir el total.'
                );
                return;
              }
              onConfirmar();
            }}
            disabled={carrito.length === 0 || !pagosValidos || isSaving || requiereConfirmarCredito}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>{isSaving ? 'Guardando…' : 'Confirmar Venta'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 8, backgroundColor: '#E5E7EB', padding: 12, borderRadius: 10, alignItems: 'center' }}
            onPress={onDescartar}
          >
            <Text style={{ color: '#111827', fontWeight: '700' }}>Descartar venta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 8, backgroundColor: '#EEE', padding: 12, borderRadius: 10, alignItems: 'center' }}
            onPress={onClose}
          >
            <Text style={{ color: '#111827', fontWeight: '700' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
