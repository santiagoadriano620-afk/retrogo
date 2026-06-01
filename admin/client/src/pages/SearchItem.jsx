import React, { useState } from 'react';
import { api } from '../api/client';

const SECTION = { background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: 20, marginBottom: 16 };

function ItemIcon({ id }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, background: '#0f0f1a', border: '1px solid #1a1a2e', overflow: 'hidden'
    }}>
      <img
        src={'/api/admin/sprites/' + id}
        alt={''}
        style={{ width: 32, height: 32, objectFit: 'contain', imageRendering: 'pixelated' }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    </div>
  );
}

export default function SearchItem({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    const itemId = parseInt(query.trim(), 10);
    if (isNaN(itemId) || itemId < 1) {
      setError('Digite um ID de item válido (ex: 2148 para gold coin)');
      return;
    }
    setError('');
    setLoading(true);
    setResults(null);
    try {
      const data = await api.searchItem(itemId);
      setResults(data);
    } catch (e) {
      setError('Erro na busca: ' + e.message);
    }
    setLoading(false);
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') search();
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>🔍 Search Item</h2>

      <div style={SECTION}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o ID do item (ex: 2148)"
            style={{
              flex: 1, background: '#0f0f1a', border: '1px solid #333', color: '#e0e0e0',
              padding: '10px 12px', borderRadius: 4, fontSize: 14, outline: 'none'
            }}
          />
          <button onClick={search} disabled={loading} style={{
            background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
            padding: '10px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            opacity: loading ? 0.5 : 1
          }}>{loading ? 'Buscando...' : 'Buscar'}</button>
        </div>
        {error && <div style={{ color: '#ff7c7c', fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>

      {results && (
        <div style={SECTION}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <ItemIcon id={results.itemId} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{results.itemName}</div>
              <div style={{ fontSize: 12, color: '#888' }}>ID: {results.itemId} — {results.results.length} player(s) possuem este item</div>
            </div>
          </div>

          {results.results.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>Nenhum player encontrado com este item.</div>
          ) : (
            results.results.map(function (r) {
              return (
                <div key={r.player} style={{
                  background: '#0f0f1a', borderRadius: 6, border: '1px solid #2a2a4a',
                  padding: 12, marginBottom: 8
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span
                      onClick={() => onNavigate('playerDetail', r.player)}
                      style={{ color: '#7c9bff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >{r.player}</span>
                    <span style={{ color: '#4caf50', fontSize: 13 }}>Total: {r.total}x</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {r.matches.map(function (m, i) {
                      return (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: '#1a1a2e', borderRadius: 4, padding: '4px 10px',
                          fontSize: 12, color: '#ccc'
                        }}>
                          <span style={{ color: '#888' }}>📍 {m.location}</span>
                          <span style={{ color: '#4caf50', fontWeight: 600 }}>{m.count}x</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
