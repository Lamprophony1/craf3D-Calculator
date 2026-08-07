import { formatPyg } from './format';

export function buildClientQuoteText(customerTotalGs: number): string {
  if (!Number.isFinite(customerTotalGs) || customerTotalGs < 0)
    throw new Error('El total de cliente debe ser un importe válido.');
  return `Cotización de impresión 3D: ${formatPyg(customerTotalGs)}`;
}
