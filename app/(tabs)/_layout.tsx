import { Tabs, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import Toast from "react-native-toast-message";
import { Colors } from "@/constants/Colors";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import BottomSheet, { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        router.replace("/(auth)/login");
      }
    };
    checkAuth();
  }, [pathname]);

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.light.primario,
          tabBarInactiveTintColor: "#888",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: "#eee",
            height: 60,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Inicio",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="inventario"
          options={{
            title: "Inventario",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cube-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="clientes"
          options={{
            title: "Clientes",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ventas"
          options={{
            title: "Ventas",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="IniciarVenta"
          options={{
            href: null, // 👈 esto lo oculta de la barra de pestañas
          }}
        />
        <Tabs.Screen
          name="historial-ventas"
          options={{
            href: null, // 👈 esto lo oculta de la barra de pestañas
          }}
        />
        <Tabs.Screen
          name="ticket"
          options={{
            href: null, // 👈 esto lo oculta de la barra de pestañas
          }}
        />
         <Tabs.Screen
          name="ruta"
          options={{
            href: null, // 👈 esto lo oculta de la barra de pestañas
          }}
        />
        <Tabs.Screen
          name="cobranza-cliente"
          options={{
            href: null, // 👈 esto lo oculta de la barra de pestañas
          }}
        />
        <Tabs.Screen
        name="TicketPrevio"
        options={{
          href: null,          // <-- lo oculta del tab bar
          title: 'TicketPrevio',
        }}
      />
       
      </Tabs>
      <Toast />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
