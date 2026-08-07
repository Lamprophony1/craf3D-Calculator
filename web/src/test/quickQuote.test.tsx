import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickQuoteScreen, QUICK_DRAFT_KEY } from '../screens/QuickQuoteScreen';
import { CalculatorScreen, DRAFT_KEY, restoreDraft } from '../screens/CalculatorScreen';

describe('cotización rápida', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('muestra únicamente filamento, tiempo y gramos como datos de entrada iniciales', () => {
    render(<QuickQuoteScreen />);
    const form = screen.getByRole('form', { name: 'Cotización rápida' });
    const dataGroups = form.querySelectorAll(':scope > label, :scope > fieldset');

    expect(dataGroups).toHaveLength(3);
    expect(within(form).getByLabelText('Filamento')).toBeInTheDocument();
    expect(within(form).getByLabelText('Horas de impresión')).toBeInTheDocument();
    expect(within(form).getByLabelText('Minutos de impresión')).toBeInTheDocument();
    expect(within(form).getByLabelText('Gramos totales del slicer')).toBeInTheDocument();
    expect(within(form).queryByText('Impresora')).not.toBeInTheDocument();
    expect(within(form).queryByText('Política')).not.toBeInTheDocument();
  });

  it('recupera el shell y el borrador local offline sin afirmar una sesión verificada', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    localStorage.setItem(QUICK_DRAFT_KEY, JSON.stringify({ spoolId: 'offline-spool', hours: 5, minutes: 24, totalGrams: 142 }));

    render(<QuickQuoteScreen />);

    expect(screen.getByRole('heading', { name: 'Cotización rápida' })).toBeInTheDocument();
    expect(screen.getByLabelText('Horas de impresión')).toHaveValue(5);
    expect(screen.getByLabelText('Minutos de impresión')).toHaveValue(24);
    expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(142);
    expect(screen.getByText(/sesión y el precio no se consideran verificados/i)).toBeInTheDocument();
  });
});

describe('tiempo ocupado avanzado', () => {
  it('se sincroniza inicialmente con impresión y solo conserva una diferencia explícita', () => {
    const automaticStorage = {
      getItem: (key: string) => key === DRAFT_KEY
        ? JSON.stringify({ printHours: 5.4, occupiedHours: 8, customOccupiedTime: false })
        : null
    };
    const explicitStorage = {
      getItem: (key: string) => key === DRAFT_KEY
        ? JSON.stringify({ printHours: 5.4, occupiedHours: 8, customOccupiedTime: true })
        : null
    };

    expect(restoreDraft(automaticStorage).occupiedHours).toBe(5.4);
    expect(restoreDraft(explicitStorage).occupiedHours).toBe(8);
  });
});

describe('cliente en cotización completa', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('permite asociar un cliente activo', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
      String(input).endsWith('/customers')
        ? [{ id: 'customer-1', name: 'Cliente activo', phone: null, email: null, isActive: true }]
        : []
    ), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(<CalculatorScreen saveAsQuote />);

    expect(await screen.findByRole('option', { name: 'Cliente activo' })).toBeInTheDocument();
  });
});
