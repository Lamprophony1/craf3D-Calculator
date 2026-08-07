import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickQuoteScreen, QUICK_DRAFT_KEY } from '../screens/QuickQuoteScreen';
import { CalculatorScreen, DRAFT_KEY, restoreDraft } from '../screens/CalculatorScreen';

describe('cotización rápida', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('muestra únicamente filamento, tiempo y gramos como datos de entrada iniciales', () => {
    render(<QuickQuoteScreen />);
    const form = screen.getByRole('form', { name: 'Datos para cotizar' });
    const dataGroups = form.querySelectorAll(':scope > .input-group');

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

    expect(screen.getByRole('heading', { name: '¿Cuánto cobrar?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Horas de impresión')).toHaveValue(5);
    expect(screen.getByLabelText('Minutos de impresión')).toHaveValue(24);
    expect(screen.getByLabelText('Gramos totales del slicer')).toHaveValue(142);
    expect(screen.getByText(/no mostramos un precio como verificado hasta reconectar/i)).toBeInTheDocument();
  });

  it('valida horas, minutos y gramos en línea sin llamar al preview con datos inválidos', async () => {
    const filament = { id: 'spool-1', material: 'PLA', color: 'Negro', productName: 'Mate', landedCostGs: 100_000, netWeightGrams: 1_000, isActive: true };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([filament]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<QuickQuoteScreen />);
    await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue(filament.id));

    fireEvent.change(screen.getByLabelText('Horas de impresión'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Minutos de impresión'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Gramos totales del slicer'), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular precio' }));

    expect(await screen.findByText('Ingresá horas completas.')).toBeInTheDocument();
    expect(screen.getByText('Los minutos deben estar entre 0 y 59.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá una cantidad de gramos mayor que cero.')).toBeInTheDocument();
    expect(screen.getByLabelText('Horas de impresión')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Horas de impresión')).toHaveAttribute('aria-describedby', 'quick-hours-error');
    expect(screen.getByLabelText('Minutos de impresión')).toHaveAttribute('aria-describedby', 'quick-minutes-error');
    expect(screen.getByLabelText('Gramos totales del slicer')).toHaveAttribute('aria-describedby', 'quick-grams-error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mantiene visible el filamento seleccionado aunque la búsqueda no coincida', async () => {
    const filaments = [
      { id: 'spool-1', material: 'PLA', color: 'Negro', productName: 'Mate', landedCostGs: 100_000, netWeightGrams: 1_000, isActive: true },
      { id: 'spool-2', material: 'PETG', color: 'Rojo', productName: 'Brillante', landedCostGs: 120_000, netWeightGrams: 1_000, isActive: true }
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(filaments), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const user = userEvent.setup();
    render(<QuickQuoteScreen />);
    await waitFor(() => expect(screen.getByLabelText('Filamento')).toHaveValue('spool-1'));

    await user.type(screen.getByLabelText('Buscar filamento'), 'Rojo');

    const select = screen.getByLabelText('Filamento');
    expect(within(select).getByRole('option', { name: /PLA · Negro/ })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /PETG · Rojo/ })).toBeInTheDocument();
    expect(select).toHaveValue('spool-1');
    await user.clear(screen.getByLabelText('Buscar filamento'));
    await user.type(screen.getByLabelText('Buscar filamento'), 'ausente');
    expect(within(select).getByRole('option', { name: /PLA · Negro/ })).toBeInTheDocument();
    expect(within(select).queryByRole('option', { name: /PETG · Rojo/ })).not.toBeInTheDocument();
    expect(screen.getByText('No encontramos otros filamentos. Conservamos el seleccionado.')).toBeInTheDocument();
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
