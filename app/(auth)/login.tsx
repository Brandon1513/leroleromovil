import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Animaciones
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // ✅ Animar logo al montar componente
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true
      })
    ]).start();

    const checkToken = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        router.replace('/(tabs)');
      }
    };
    checkToken();
  }, []);

  const handleLogin = async () => {
    if (email === '' || password === '') {
      return Toast.show({ type: 'error', text1: 'Completa todos los campos' });
    }

    try {
      const response = await fetch('http://192.168.1.222/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Credenciales inválidas');
      }

      const data = await response.json();
      await AsyncStorage.setItem('authToken', data.token);

      Toast.show({
        type: 'success',
        text1: 'Inicio de sesión exitoso'
      });

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1000);

    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: error.message || 'Error al iniciar sesión'
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* ✅ Logo animado */}
      <Animated.Image
        source={require('../../assets/images/lerolero-logo.png')}
        style={[
          styles.logo,
          {
            opacity: opacity,
            transform: [{ scale: scale }]
          }
        ]}
        resizeMode="contain"
      />

      <Text style={styles.title}>Iniciar Sesión</Text>

      <TextInput
        placeholder="Correo electrónico"
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
        >
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Ingresar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff'
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#333'
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
    paddingRight: 40,
    marginBottom: 16
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
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  }
});
