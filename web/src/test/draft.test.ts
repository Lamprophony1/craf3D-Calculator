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
});
