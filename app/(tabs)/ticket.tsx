import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors } from '@/constants/Colors';

// Logo en base64
const LOGO_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...'; // aquí pondrás tu logo real en base64

export default function Ticket() {
  const { cliente, productos, total, observaciones, fecha, cambios } = useLocalSearchParams();
  const cambiosList = cambios ? JSON.parse(cambios) : [];


  if (!cliente || !productos) {
    return <Text style={styles.error}>Error: No hay información de la venta.</Text>;
  }

  const clienteObj = JSON.parse(cliente);
  const productosList = JSON.parse(productos);
  const fechaFormateada = new Date(fecha).toLocaleString();

  const generarHTML = () => {
    const resumenCambios = cambiosList.length > 0
      ? cambiosList.map(c => `
        <div>${c.producto} x ${c.cantidad} - Motivo: ${c.motivo}</div>
      `).join('')
      : '';
  
    const totalDevueltos = cambiosList.reduce((acc, c) => acc + Number(c.cantidad), 0);
  
    return `
      <html>
        <head>
          <style>
            body {
              font-family: monospace;
              font-size: 12px;
              padding: 20px;
              color: #000;
            }
            .center {
              text-align: center;
            }
            .bold {
              font-weight: bold;
            }
            .section {
              margin-top: 10px;
              margin-bottom: 10px;
            }
            .line {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .barcode {
              margin-top: 20px;
              text-align: center;
              font-size: 24px;
              letter-spacing: 2px;
            }
          </style>
        </head>
        <body>
          <div class="center">
            <img src="${LOGO_BASE64}" width="100" />
            <div class="bold">Netcore Systems</div>
            <div>C. Hornos 220</div>
            <div>San Juan, 45500</div>
            <div>San Pedro Tlaquepaque, Jal.</div>
            <div class="line"></div>
            <div class="bold">🧾 Ticket de Venta</div>
          </div>
  
          <div class="section">
            <div><strong>Cliente:</strong> ${clienteObj.nombre}</div>
            <div><strong>Fecha:</strong> ${fechaFormateada}</div>
            <div><strong>Observaciones:</strong> ${observaciones || 'Sin observaciones'}</div>
          </div>
  
          <div class="line"></div>
  
          <div class="section">
            <div><strong>Productos:</strong></div>
            ${productosList.map(p => (
              `<div>${p.producto.nombre} x ${p.cantidad} = $${(p.cantidad * p.producto.precio).toFixed(2)}</div>`
            )).join('')}
          </div>
  
          ${cambiosList.length > 0 ? `
            <div class="line"></div>
            <div class="section">
              <div><strong>Productos Devueltos:</strong></div>
              ${resumenCambios}
              <div class="bold">Total devueltos: ${totalDevueltos}</div>
            </div>
          ` : ''}
  
          <div class="line"></div>
  
          <div class="center bold">Total: $${parseFloat(total).toFixed(2)}</div>
  
          <div class="barcode">|| ||| ||||| | ||</div>
          <div class="center">¡Gracias por tu compra!</div>
        </body>
      </html>
    `;
  };
  

  const crearYCompartirPDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({
        html: generarHTML(),
        base64: false,
      });

      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Error al generar ticket', error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🧾 Ticket de Venta</Text>

      <View style={styles.section}>
        <Text style={styles.label}><Ionicons name="person" /> Cliente:</Text>
        <Text>{clienteObj.nombre}</Text>

        <Text style={styles.label}><Ionicons name="calendar" /> Fecha:</Text>
        <Text>{fechaFormateada}</Text>

        <Text style={styles.label}><Ionicons name="chatbox" /> Observaciones:</Text>
        <Text>{observaciones || 'Sin observaciones'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>🧂 Productos</Text>
        {productosList.map((p, i) => (
          <Text key={i}>
            {p.producto.nombre} x {p.cantidad} = ${(
              p.cantidad * p.producto.precio
            ).toFixed(2)}
          </Text>
        ))}
      </View>

      {cambiosList.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>♻️ Productos Devueltos</Text>
          {cambiosList.map((c, i) => (
            <Text key={i}>
              {c.producto} x {c.cantidad} - Motivo: {c.motivo}
            </Text>
          ))}
        </View>
      )}


      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>Total: ${parseFloat(total).toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={crearYCompartirPDF}>
        <Ionicons name="document-outline" size={20} color="#fff" />
        <Text style={styles.btnText}>Compartir Ticket PDF</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f2f2f2',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.primario,
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  label: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 2,
  },
  totalContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primario,
  },
  btn: {
    flexDirection: 'row',
    backgroundColor: Colors.light.primario,
    padding: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  error: {
    marginTop: 40,
    textAlign: 'center',
    color: 'red',
  },
});
