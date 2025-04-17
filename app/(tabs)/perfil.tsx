import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { Ionicons } from "@expo/vector-icons";
import { perfilStyle } from "@/assets/Styles/Perfil.style";

export default function PerfilScreen() {
  const router = useRouter();
  const [user, setUser] = useState({ name: "", email: "" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return router.replace("/(auth)/login");

      try {
        const res = await fetch("http://192.168.1.222/api/me", {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setUser({ name: data.name, email: data.email });
      } catch (error) {
        Toast.show({ type: "error", text1: "Error al cargar perfil" });
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("authToken");
    Toast.show({ type: "info", text1: "Sesión cerrada" });
    router.replace("/(auth)/login");
  };

  const handlePasswordChange = async () => {
    if (password !== confirmPassword) {
      return Toast.show({
        type: "error",
        text1: "Las contraseñas no coinciden",
      });
    }

    const token = await AsyncStorage.getItem("authToken");

    try {
      const res = await fetch("http://192.168.1.222/api/update-password", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password,
          password_confirmation: confirmPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al actualizar contraseña");
      }

      // ✅ Mostrar mensaje
      Toast.show({
        type: "success",
        text1: "Contraseña actualizada correctamente. Inicia sesión de nuevo.",
      });

      // ✅ Eliminar token y redirigir a login
      setTimeout(async () => {
        await AsyncStorage.removeItem("authToken");
        router.replace("/(auth)/login");
      }, 1000);
    } catch (err: any) {
      Toast.show({ type: "error", text1: err.message });
    }
  };

  return (
    <ScrollView contentContainerStyle={perfilStyle.container}>
      <Text style={perfilStyle.title}>Mi Perfil</Text>

      <Text style={perfilStyle.label}>Nombre</Text>
      <Text style={perfilStyle.info}>{user.name}</Text>

      <Text style={perfilStyle.label}>Correo electrónico</Text>
      <Text style={perfilStyle.info}>{user.email}</Text>

      <Text style={[perfilStyle.title, { marginTop: 40 }]}>Cambiar Contraseña</Text>

      <View style={perfilStyle.inputWrapper}>
        <TextInput
          placeholder="Nueva contraseña"
          secureTextEntry={!showPassword}
          style={perfilStyle.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={perfilStyle.eyeIcon}
        >
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <View style={perfilStyle.inputWrapper}>
        <TextInput
          placeholder="Confirmar contraseña"
          secureTextEntry={!showConfirm}
          style={perfilStyle.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity
          onPress={() => setShowConfirm(!showConfirm)}
          style={perfilStyle.eyeIcon}
        >
          <Ionicons
            name={showConfirm ? "eye-off" : "eye"}
            size={20}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={perfilStyle.button} onPress={handlePasswordChange}>
        <Text style={perfilStyle.buttonText}>Actualizar contraseña</Text>
      </TouchableOpacity>

      <TouchableOpacity style={perfilStyle.logoutButton} onPress={handleLogout}>
        <Text style={perfilStyle.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}


