// constants/Config.tsx

const useLocal = true; // 🔁 Cambia a true cuando desarrolles en local

export const API_BASE_URL = useLocal
  ? 'http://192.168.100.16'  // IP local
  : 'https://lerolerob.domcloud.dev'; // Producción