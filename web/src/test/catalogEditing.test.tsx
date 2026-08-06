import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { CatalogScreen } from '../screens/CatalogScreens';

afterEach(() => vi.unstubAllGlobals());

it('edita y desactiva una impresora seeded mediante PUT real', async () => {
  const printer = {
    id: '20000000-0000-0000-0000-000000000001', name: 'Bambu Lab A1', manufacturer: 'Bambu Lab', model: 'A1', voltage: 220,
    machineCostMode: 'ManualHourlyRate', purchaseCostGs: null, residualValueGs: 0, usefulLifeHours: null,
    expectedLifetimeRepairCostGs: 0, maintenanceReserveGsPerHour: 0, recoveryYears: null, businessDaysPerYear: null,
    plannedBillableHoursPerDay: null, repairReserveGsPerHour: 0, manualHourlyRateGs: null, isActive: true
  };
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PUT') return new Response(JSON.stringify({ ...printer, ...JSON.parse(String(init.body)) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify([printer]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();

  render(<CatalogScreen resource="printers" />);
  await screen.findByText('Bambu Lab A1');
  await user.click(screen.getByRole('button', { name: 'Editar' }));
  const rate = screen.getByLabelText('Costo manual por hora (Gs)');
  await user.type(rate, '2500');
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    '/api/printers/20000000-0000-0000-0000-000000000001',
    expect.objectContaining({ method: 'PUT' })
  ));
  const editCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
  expect(JSON.parse(String(editCall?.[1]?.body)).manualHourlyRateGs).toBe(2500);

  await user.click(screen.getByRole('button', { name: 'Desactivar' }));
  await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2));
  const deactivateCall = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')[1];
  expect(JSON.parse(String(deactivateCall[1]?.body)).isActive).toBe(false);
});
