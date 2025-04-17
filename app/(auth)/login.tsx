import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "@/constants/Config";
import { loginStyle } from "./login.style";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    const checkToken = async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        router.replace("/(tabs)");
      }
    };
    checkToken();
  }, []);

  const handleLogin = async () => {
    if (email === "" || password === "") {
      return Toast.show({ type: "error", text1: "Completa todos los campos" });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Credenciales inválidas");
      }

      const data = await response.json();
      await AsyncStorage.setItem("authToken", data.token);

      Toast.show({
        type: "success",
        text1: "Inicio de sesión exitoso",
      });

      setTimeout(() => {
        router.replace("/(tabs)");
      }, 1000);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: error.message || "Error al iniciar sesión",
      });
    }
  };

  const pruebaLogin = () => {
    AsyncStorage.setItem("authToken", "fake-token");
    router.replace("/(tabs)");
  }

  return (
    <View style={loginStyle.container}>
      <Animated.Image
        source={require("../../assets/images/lerolero-logo.png")}
        style={[
          loginStyle.logo,
          {
            opacity: opacity,
            transform: [{ scale: scale }],
          },
        ]}
        resizeMode="contain"
      />

      <Text style={loginStyle.title}>Iniciar Sesión</Text>

      <TextInput
        placeholder="Correo electrónico"
        style={loginStyle.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <View style={loginStyle.inputWrapper}>
        <TextInput
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          style={loginStyle.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={loginStyle.eyeIcon}
        >
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={loginStyle.button} onPress={pruebaLogin}>
        <Text style={loginStyle.buttonText}>Ingresar</Text>
      </TouchableOpacity>
    </View>
  );
}
