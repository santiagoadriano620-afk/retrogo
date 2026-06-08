import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const VOCATIONS = ['None', 'Sorcerer', 'Druid', 'Paladin', 'Knight'];

const INPUT = {
  background: '#0f0f1a', border: '1px solid #333', color: '#e0e0e0', padding: '8px 12px',
  borderRadius: 4, fontSize: 13, outline: 'none'
};

export default function Players({ onNavigate }) {
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vocation, setVocation] = useState('');
  const [onlineList, setOnlineList] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = { page, limit: 50 };
    if (search) params.search = search;
    if (vocation) params.vocation = vocation;
    const [result, online] = await Promise.all([api.getPlayers(params), api.getOnlinePlayers()]);
    if (result.players) setPlayers(result.players);
    if (result.total !== undefined) setTotal(result.total);
    if (online.players) setOnlineList(new Set(online.players.map(p => p.name.toLowerCase())));
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, vocation]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 300); return () => clearTimeout(t); }, [search]);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Players ({total})</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...INPUT, width: 220 }} placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={INPUT} value={vocation} onChange={e => setVocation(e.target.value)}>
          <option value="">Todas vocations</option>
          {VOCATIONS.map((v, i) => <option key={i} value={i}>{v}</option>)}
        </select>
        <button onClick={load} style={{
          background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff', padding: '8px 16px',
          borderRadius: 4, cursor: 'pointer', fontSize: 13
        }}>Atualizar</button>
      </div>

      {loading ? <div style={{ color: '#888' }}>Carregando...</div> : (
        <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#888', borderBottom: '1px solid #2a2a4a', background: '#141428' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Level</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Vocation</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Exp</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.name} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px 12px' }}>{p.level}</td>
                  <td style={{ padding: '10px 12px' }}>{VOCATIONS[p.vocation] || p.vocation}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      color: onlineList.has(p.name.toLowerCase()) ? '#4caf50' : '#666',
                      fontSize: 12
                    }}>
                      {onlineList.has(p.name.toLowerCase()) ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{p.experience?.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => onNavigate('playerDetail', p.name)} style={{
                      background: 'transparent', border: '1px solid #3a3a5a', color: '#7c9bff',
                      padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12
                    }}>Detalhes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{
          background: '#2a2a4a', border: '1px solid #3a3a5a', color: page <= 1 ? '#444' : '#7c9bff',
          padding: '6px 14px', borderRadius: 4, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 13
        }}>Anterior</button>
        <span style={{ color: '#888', fontSize: 13 }}>Página {page}</span>
        <button onClick={() => setPage(p => p + 1)} style={{
          background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
          padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13
        }}>Próximo</button>
      </div>
    </div>
  );
}
