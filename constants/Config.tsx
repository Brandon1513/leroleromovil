// constants/Config.tsx

const useLocal = false; // 🔁 Cambia a true cuando desarrolles en local

export const API_BASE_URL = useLocal
  ? 'http://192.168.0.100'  // IP local
  : 'https://lerolerob.domcloud.dev'; // Producción