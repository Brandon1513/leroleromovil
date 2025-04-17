import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function SplashScreen() {
  const router = useRouter();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ⏯️ Inicia la animación
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // ⏳ Espera animación y decide ruta
    const checkAuth = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800)); // Espera tras animación
      const token = await AsyncStorage.getItem("authToken");
      //router.replace(token ? "/(tabs)" : "/(auth)/login");
      router.replace("/(tabs)");
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/images/lerolero-logo.png")}
        style={[
          styles.logo,
          {
            opacity: opacity,
            transform: [{ scale: scale }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 200,
    height: 200,
  },
});
