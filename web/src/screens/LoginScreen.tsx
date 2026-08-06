import { useState } from 'react';
import type { LoginOption } from '../api/types';
import { APP_DESCRIPTION, APP_NAME, MASTER_LOGO_PATH } from '../config/app';

export function LoginScreen({ options, loading, error, onLogin }: {
  options: LoginOption[];
  loading: boolean;
  error: string | null;
  onLogin: (username: string, pin: string) => Promise<boolean>;
}) {
  const [username, setUsername] = useState(options[0]?.username ?? '');
  const [pin, setPin] = useState('');
  return <main className="login-page">
    <form className="login-card" onSubmit={async (event) => {
      event.preventDefault();
      if (await onLogin(username, pin)) setPin('');
    }}>
      <img className="login-logo" src={MASTER_LOGO_PATH} alt="Logo de la aplicación" />
      <h1>{APP_NAME}</h1><p>{APP_DESCRIPTION}</p>
      <label>Usuario<select value={username} onChange={(event) => { setUsername(event.target.value); setPin(''); }} required>
        <option value="">Seleccioná</option>{options.map((option) => <option key={option.id} value={option.username}>{option.displayName}</option>)}
      </select></label>
      <label>PIN<input aria-label="PIN" type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6}
        value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} required /></label>
      {error ? <p role="alert" className="error">{error}</p> : null}
      <button type="submit" disabled={loading || !username || pin.length < 4}>{loading ? 'Ingresando…' : 'Entrar'}</button>
    </form>
  </main>;
}

