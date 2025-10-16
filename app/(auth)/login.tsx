import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "@/constants/Config";
import { loginStyle } from "./login.style";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passRef = useRef<TextInput>(null);

  // animaciones
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    // si ya hay token, entra directo
    (async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (token) router.replace("/(tabs)");
    })();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({ type: "error", text1: "Completa todos los campos" });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error("Credenciales inválidas");

      const data = await response.json();
      await AsyncStorage.setItem("authToken", data.token);

      Toast.show({ type: "success", text1: "Inicio de sesión exitoso" });
      router.replace("/(tabs)");
    } catch (error: any) {
      Toast.show({ type: "error", text1: error?.message || "Error al iniciar sesión" });
    } finally {
      setLoading(false);
    }
  };

  // Para pruebas rápidas:
  // const pruebaLogin = () => { AsyncStorage.setItem("authToken", "fake-token"); router.replace("/(tabs)"); };

  return (
    <SafeAreaView style={loginStyle.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={loginStyle.container}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <Animated.Image
              source={require("../../assets/images/lerolero-logo.png")}
              style={[loginStyle.logo, { opacity, transform: [{ scale }] }]}
              resizeMode="contain"
            />

            <Text style={loginStyle.title}>Iniciar Sesión</Text>

            <TextInput
              placeholder="Correo electrónico"
              placeholderTextColor="#9CA3AF"
              style={loginStyle.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />

            <View style={loginStyle.inputWrapper}>
              <TextInput
                ref={passRef}
                placeholder="Contraseña"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                style={loginStyle.input}
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={loginStyle.eyeIcon}
                accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[loginStyle.button, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={loginStyle.buttonText}>Ingresar</Text>
              )}
            </TouchableOpacity>

            {/* Espaciador para evitar que el botón quede bajo el teclado */}
            <View style={{ height: 24 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
