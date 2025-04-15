import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const options = [
  {
    id: '1',
    label: 'Clientes',
    icon: <Feather name="users" size={32} color="#facc15" />,
    route: '/(tabs)/clientes'
  },
  {
    id: '2',
    label: 'Inventario',
    icon: <Ionicons name="cube-outline" size={32} color="#facc15" />,
    route: '/(tabs)/inventario'
  },
  {
    id: '3',
    label: 'Nueva Venta',
    icon: <Ionicons name="add-circle-outline" size={32} color="#facc15" />,
    route: '/(tabs)/ventas'
  },
  {
    id: '4',
    label: 'Perfil',
    icon: <Ionicons name="person-outline" size={32} color="#facc15" />,
    route: '/(tabs)/perfil'
  }
];

export default function HomeScreen() {
  const router = useRouter();

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(item.route)}
    >
      {item.icon}
      <Text style={styles.label}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido 👋</Text>
      <FlatList
        data={options}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center'
  },
  grid: {
    gap: 16,
    alignItems: 'center'
  },
  card: {
    backgroundColor: '#fefce8',
    borderRadius: 16,
    padding: 24,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '42%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  }
});
