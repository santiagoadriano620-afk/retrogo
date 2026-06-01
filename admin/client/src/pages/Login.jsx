import React, { useState } from 'react';
import { api } from '../api/client';

const STYLE = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f0f1a' },
  card: { background: '#1a1a2e', padding: 32, borderRadius: 8, width: 360, border: '1px solid #2a2a4a' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#7c9bff', marginBottom: 24, textAlign: 'center' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 4, border: '1px solid #333', background: '#0f0f1a',
    color: '#e0e0e0', fontSize: 14, marginBottom: 12, outline: 'none' },
  button: { width: '100%', padding: '10px 0', background: '#7c9bff', border: 'none', borderRadius: 4,
    color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  error: { color: '#ff6b6b', fontSize: 13, marginBottom: 12, textAlign: 'center' }
};

export default function Login({ onLogin }) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await api.login(account, password);
    setLoading(false);
    if (result.success) {
      onLogin();
    } else {
      setError(result.error || 'Falha no login');
    }
  };

  return (
    <div style={STYLE.container}>
      <form style={STYLE.card} onSubmit={handleSubmit}>
        <div style={STYLE.title}>Painel Admin</div>
        {error && <div style={STYLE.error}>{error}</div>}
        <input style={STYLE.input} placeholder="Email da conta" value={account} onChange={e => setAccount(e.target.value)} autoFocus />
        <input style={STYLE.input} type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
        <button style={STYLE.button} disabled={loading} type="submit">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
