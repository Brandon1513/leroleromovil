import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

export default function PerfilScreen() {
  const router = useRouter();
  const [user, setUser] = useState({ name: '', email: '' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return router.replace('/(auth)/login');

      try {
        const res = await fetch('http://192.168.1.222/api/me', {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();
        setUser({ name: data.name, email: data.email });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Error al cargar perfil' });
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('authToken');
    Toast.show({ type: 'info', text1: 'Sesión cerrada' });
    router.replace('/(auth)/login');
  };

  const handlePasswordChange = async () => {
  if (password !== confirmPassword) {
    return Toast.show({ type: 'error', text1: 'Las contraseñas no coinciden' });
  }

  const token = await AsyncStorage.getItem('authToken');

  try {
    const res = await fetch('http://192.168.1.222/api/update-password', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        password,
        password_confirmation: confirmPassword
      })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Error al actualizar contraseña');
    }

    // ✅ Mostrar mensaje
    Toast.show({
      type: 'success',
      text1: 'Contraseña actualizada correctamente. Inicia sesión de nuevo.'
    });

    // ✅ Eliminar token y redirigir a login
    setTimeout(async ()=>{
        await AsyncStorage.removeItem('authToken');
        router.replace('/(auth)/login');
    }, 1000);

  } catch (err: any) {
    Toast.show({ type: 'error', text1: err.message });
  }
};


  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mi Perfil</Text>

      <Text style={styles.label}>Nombre</Text>
      <Text style={styles.info}>{user.name}</Text>

      <Text style={styles.label}>Correo electrónico</Text>
      <Text style={styles.info}>{user.email}</Text>

      <Text style={[styles.title, { marginTop: 40 }]}>Cambiar Contraseña</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Nueva contraseña"
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Confirmar contraseña"
          secureTextEntry={!showConfirm}
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
          <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handlePasswordChange}>
        <Text style={styles.buttonText}>Actualizar contraseña</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    flexGrow: 1
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16
  },
  label: {
    fontWeight: '600',
    marginTop: 16,
    color: '#555'
  },
  info: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8
  },
  inputWrapper: {
    position: 'relative',
    marginTop: 12
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    paddingRight: 40
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 14
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600'
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600'
  }
});
