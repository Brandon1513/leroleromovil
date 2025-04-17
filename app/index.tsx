import { useRouter, useNavigationContainerRef } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

export default function IndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/splash"); // redirige cuando ya está listo
    }, 50); // pequeño delay asegura que el layout cargue

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
