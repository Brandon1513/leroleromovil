// utils/money.ts (o donde lo tengas)
export const money = (n: number) => {
  const x = Number(n || 0);
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(x);
  } catch {
    // Fallback por si Intl falla en algún dispositivo
    return `$${x.toFixed(2)}`;
  }
};
