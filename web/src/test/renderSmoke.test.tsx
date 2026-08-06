import { render, screen } from '@testing-library/react';
import { LoginScreen } from '../screens/LoginScreen';

describe('login', () => {
  it('renders PIN login controls accessibly', () => {
    render(<LoginScreen options={[{ id: '1', username: 'rafa', displayName: 'Rafa' }]} loading={false} error={null} onLogin={async () => true} />);
    expect(screen.getByRole('heading', { name: 'Calculadora 3D' })).toBeInTheDocument();
    expect(screen.getByLabelText('PIN')).toHaveAttribute('inputmode', 'numeric');
  });
});
