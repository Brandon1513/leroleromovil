import { Tabs, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import Toast from 'react-native-toast-message';

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        router.replace('/(auth)/login');
      }
    };
    checkAuth();
  }, [pathname]);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#facc15',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#eee',
            height: 60
          }
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="inventario"
          options={{
            title: 'Inventario',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cube-outline" size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="clientes"
          options={{
            title: 'Clientes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="ventas"
          options={{
            title: 'Ventas',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color} />
            )
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            )
          }}
        />
      </Tabs>

      {/* ✅ Aquí se monta el Toast global */}
      <Toast />
    </>
  );
}
