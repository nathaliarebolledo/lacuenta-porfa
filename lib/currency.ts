const FORMATTERS: Record<string, Intl.NumberFormat> = {};

function getFormatter(currency: string) {
  if (!FORMATTERS[currency]) {
    FORMATTERS[currency] = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'CLP' ? 0 : 2,
      maximumFractionDigits: currency === 'CLP' ? 0 : 2,
    });
  }
  return FORMATTERS[currency];
}

export function formatMoney(amount: number, currency: string = 'CLP') {
  try {
    return getFormatter(currency).format(amount || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0).toLocaleString('es-CL')}`;
  }
}

export function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0$/, '');
}
