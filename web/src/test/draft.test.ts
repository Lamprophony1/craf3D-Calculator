import { QUICK_TO_ADVANCED_KEY } from '../screens/QuickQuoteScreen';
import { DRAFT_KEY, initialDraft, restoreDraft, withTechnicalSelection } from '../screens/CalculatorScreen';

describe('quote draft', () => {
  it('restores a saved local draft', () => {
    const storage = { getItem: (key: string) => key === DRAFT_KEY ? JSON.stringify({ grams: 142, printHours: 5.4 }) : null };
    expect(restoreDraft(storage).grams).toBe(142);
    expect(restoreDraft(storage).printHours).toBe(5.4);
  });

  it('recovers from invalid local data', () => {
    expect(restoreDraft({ getItem: () => '{invalid' }).quantity).toBe(1);
  });

  it('preserves the quick-quote fallback context until printer or profile changes', () => {
    const values = new Map<string, string>([[QUICK_TO_ADVANCED_KEY, JSON.stringify({
      printerId: 'printer-1', energyProfileId: 'energy-1', printDurationHours: 5.4,
      calculationContext: 'QuickQuote', acceptStandardEnergyFallback: true
    })]]);
    const quick = initialDraft({ getItem: key => values.get(key) ?? null, removeItem: key => { values.delete(key); } });

    expect(quick.calculationContext).toBe('QuickQuote');
    expect(quick.acceptStandardEnergyFallback).toBe(true);
    expect({ ...quick, grams: 200 }.calculationContext).toBe('QuickQuote');

    const changed = withTechnicalSelection(quick, 'energyProfileId', 'energy-2');
    expect(changed.calculationContext).toBe('Standard');
    expect(changed.acceptStandardEnergyFallback).toBe(false);
  });

  it('imports economic inputs from a clean draft instead of another quote', () => {
    const values = new Map<string, string>([
      [DRAFT_KEY, JSON.stringify({ quantity: 10, unitsPerPlate: 3, inputBasis: 'PerPlate', idleHours: 3,
        measuredKWh: '4', warmupKWh: 2, accessoryKWh: 1, secondSpoolId: 'old', secondGrams: 40,
        laborMinutes: 60, additionalCostGs: 9000, discountGs: 4000, manualPriceReason: 'Viejo',
        customerId: 'another-customer', notes: 'Otro pedido', lineDescription: 'Otro objeto',
        quoteLines: [{ id: 'old-line', description: 'Vieja', grams: 200, printHours: 5, spoolId: 'old' }] })],
      [QUICK_TO_ADVANCED_KEY, JSON.stringify({ printerId: 'p1', energyProfileId: 'e1', electricityTariffId: 't1',
        pricingPolicyId: 'policy', quantity: { quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit' },
        printDurationHours: 3.5, occupiedPrinterHours: 3.5, materials: [{ spoolId: 'quick', slicerTotalGrams: 131.04 }],
        labor: [], additionalCosts: [], calculationContext: 'QuickQuote', acceptStandardEnergyFallback: true })]
    ]);
    const draft = initialDraft({ getItem: key => values.get(key) ?? null, removeItem: key => { values.delete(key); } });

    expect(draft).toMatchObject({ quantity: 1, unitsPerPlate: 1, inputBasis: 'PerUnit', printHours: 3.5,
      occupiedHours: 3.5, idleHours: 0, measuredKWh: '', warmupKWh: 0, accessoryKWh: 0,
      secondSpoolId: '', secondGrams: 0, laborMinutes: 0, additionalCostGs: 0, discountGs: 0,
      manualNetPriceGs: '', manualPriceReason: '', quoteLines: [], customerId: '', notes: '', lineDescription: 'Impresión 3D' });
    expect(values.has(QUICK_TO_ADVANCED_KEY)).toBe(false);
  });

  it('imports quantity, occupied time and all consumption values explicitly provided', () => {
    const request = { quantity: { quantity: 2, unitsPerPlate: 4, inputBasis: 'PerPlate' },
      printDurationHours: 2, occupiedPrinterHours: 3, idleDurationHours: 0.5, measuredKWh: 0,
      additionalWarmupKWh: 0.25, additionalAccessoryKWh: 0.75 };
    const draft = initialDraft({ getItem: key => key === QUICK_TO_ADVANCED_KEY ? JSON.stringify(request) : null, removeItem: () => undefined });
    expect(draft).toMatchObject({ quantity: 2, unitsPerPlate: 4, inputBasis: 'PerPlate', printHours: 2,
      occupiedHours: 3, customOccupiedTime: true, idleHours: 0.5, measuredKWh: '0', warmupKWh: 0.25, accessoryKWh: 0.75 });
  });

  it('imports all quick plates instead of restoring a different full quote', () => {
    const lines = [
      { description: 'Plato 1', isPrintPlate: true, calculation: { printDurationHours: 1,
        materials: [{ spoolId: 'rollo-1', slicerTotalGrams: 50 }] } },
      { description: 'Plato 2', isPrintPlate: true, calculation: { printDurationHours: 2.5,
        energyProfileId: 'perfil-2', materials: [{ spoolId: 'rollo-2', slicerTotalGrams: 71 }] } }
    ];
    const values = new Map([[DRAFT_KEY, JSON.stringify({ grams: 500 })], [QUICK_TO_ADVANCED_KEY, JSON.stringify({ lines })]]);
    const draft = initialDraft({ getItem: key => values.get(key) ?? null, removeItem: key => { values.delete(key); } });

    expect(draft).toMatchObject({ plateMode: true, spoolId: 'rollo-1', grams: 50, printHours: 1,
      quoteLines: [{ description: 'Plato 2', spoolId: 'rollo-2', grams: 71, printHours: 2.5, calculation: lines[1].calculation }] });
    expect(values.has(QUICK_TO_ADVANCED_KEY)).toBe(false);
  });
});
