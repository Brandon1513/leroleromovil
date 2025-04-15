import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';

export default function AuthLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </>
  );
}
