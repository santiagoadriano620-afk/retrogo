import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const CARD = { background: '#1a1a2e', borderRadius: 8, padding: 20, border: '1px solid #2a2a4a' };
const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 };

const VOCATIONS = ['None', 'Sorcerer', 'Druid', 'Paladin', 'Knight'];

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    const [dash, online] = await Promise.all([api.getDashboard(), api.getOnlinePlayers()]);
    setData(dash);
    if (online.players) setOnlinePlayers(online.players);
    if (online.error) setError('Engine offline: ' + online.error);
  };

  useEffect(() => { load(); }, []);

  const fmt = (ms) => { if (!ms) return '-'; const s = Math.floor(ms / 1000); return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm'; };

  if (!data) return <div style={{ color: '#888' }}>Carregando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Dashboard</h2>
        <button onClick={load} style={{
          background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff', padding: '6px 14px',
          borderRadius: 4, cursor: 'pointer', fontSize: 12
        }}>🔄 Atualizar</button>
      </div>
      {error && <div style={{ background: '#3a1a1a', color: '#ff7c7c', padding: '8px 12px', borderRadius: 4, marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={GRID}>
        <div style={CARD}>
          <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Servidor</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: data.server.online ? '#4caf50' : '#f44336' }}>
            {data.server.online ? 'Online' : 'Offline'}
          </div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Uptime: {fmt(data.server.uptime)}</div>
        </div>
        <div style={CARD}>
          <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Players Online</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7c9bff' }}>{data.server.playersOnline || 0}</div>
        </div>
        <div style={CARD}>
          <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Total Characters</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#e0e0e0' }}>{data.database.totalCharacters}</div>
        </div>
        <div style={CARD}>
          <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Total Contas</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#e0e0e0' }}>{data.database.totalAccounts}</div>
        </div>
      </div>

      <div style={{ ...CARD, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16 }}>Players Online</h3>
          <button onClick={() => onNavigate('players')} style={{
            background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff', padding: '6px 14px',
            borderRadius: 4, cursor: 'pointer', fontSize: 12
          }}>Ver Todos</button>
        </div>
        {onlinePlayers.length === 0 ? (
          <div style={{ color: '#666', fontSize: 13 }}>Nenhum player online.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#888', borderBottom: '1px solid #2a2a4a' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Level</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>Vocation</th>
                <th style={{ textAlign: 'left', padding: '8px 4px' }}>HP</th>
              </tr>
            </thead>
            <tbody>
              {onlinePlayers.map(p => (
                <tr key={p.name} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td style={{ padding: '8px 4px' }}>{p.name}</td>
                  <td style={{ padding: '8px 4px' }}>{p.level}</td>
                  <td style={{ padding: '8px 4px' }}>{VOCATIONS[p.vocation] || p.vocation}</td>
                  <td style={{ padding: '8px 4px' }}>{p.health}/{p.maxHealth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
