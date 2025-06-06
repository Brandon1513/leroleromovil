import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { homeStyle } from '@/assets/Styles/Home.style';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const options = [
  {
    id: '1',
    label: 'Clientes',
    icon: <Feather name="users" size={32} color={Colors.light.primario} />,
    route: '/(tabs)/clientes'
  },
  {
    id: '2',
    label: 'Inventario',
    icon: <Ionicons name="cube-outline" size={32}  color={Colors.light.primario} />,
    route: '/(tabs)/inventario'
  },
  {
    id: '3',
    label: 'Nueva Venta',
    icon: <Ionicons name="add-circle-outline" size={32}  color={Colors.light.primario} />,
    route: '/(tabs)/ventas'
  },
  {
    id: '4',
    label: 'Perfil',
    icon: <Ionicons name="person-outline" size={32} color={Colors.light.primario} />,
    route: '/(tabs)/perfil'
  },
  {
    id: '5',
    label: 'Rutas',
    icon: <Ionicons name="map-outline" size={32} color={Colors.light.primario} />,
    route: '/(tabs)/ruta'
  },
];

export default function HomeScreen() {
  const router = useRouter();

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <TouchableOpacity
      style={[
        homeStyle.card,
        options.length % 2 !== 0 && index === options.length - 1 && homeStyle.cardFullWidth,
      ]}
      onPress={() => router.push(item.route)}
    >
      {item.icon}
      <Text style={homeStyle.label}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={homeStyle.container}>
      <Text style={homeStyle.title}>Bienvenido 👋</Text>
      <FlatList
        data={options}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={homeStyle.grid}
      />
    </SafeAreaView>
  );
}
