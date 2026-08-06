import { DRAFT_KEY, restoreDraft } from '../screens/CalculatorScreen';

describe('quote draft', () => {
  it('restores a saved local draft', () => {
    const storage = { getItem: (key: string) => key === DRAFT_KEY ? JSON.stringify({ grams: 142, printHours: 5.4 }) : null };
    expect(restoreDraft(storage).grams).toBe(142);
    expect(restoreDraft(storage).printHours).toBe(5.4);
  });

  it('recovers from invalid local data', () => {
    expect(restoreDraft({ getItem: () => '{invalid' }).quantity).toBe(1);
  });
});

