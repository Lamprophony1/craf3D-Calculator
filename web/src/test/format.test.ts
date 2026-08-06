import { formatPyg } from '../utils/format';

describe('formatPyg', () => {
  it('formats integer guaraní amounts with es-PY', () => {
    expect(formatPyg(85000)).toMatch(/85[.\s]000/);
    expect(formatPyg(85000)).toMatch(/₲|Gs\./);
  });
});
