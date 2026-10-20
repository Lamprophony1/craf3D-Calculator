import { formatPyg } from './format';

export function buildClientQuoteText(customerTotalGs: number, customerReference?: string, description?: string): string {
  if (!Number.isFinite(customerTotalGs) || customerTotalGs < 0)
    throw new Error('El total de cliente debe ser un importe válido.');
  return [customerReference?.trim() ? `Cliente: ${customerReference.trim()}` : null,
    description?.trim() || null, `Cotización de impresión 3D: ${formatPyg(customerTotalGs)}`].filter(Boolean).join('\n');
}
