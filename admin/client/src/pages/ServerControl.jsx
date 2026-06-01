import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import Terminal from '../components/Terminal';

const BTN = {
  padding: '10px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 14, fontWeight: 600,
  border: 'none', display: 'flex', alignItems: 'center', gap: 8
};

const SECTION = { background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: 20, marginBottom: 16 };

export default function ServerControl() {
  const [status, setStatus] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [loading, setLoading] = useState({});
  const [log, setLog] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => { loadStatus(); }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [log]);

  const loadStatus = async () => {
    const r = await api.getServerStatus();
    setStatus(r);
  };

  const act = async (action, fn) => {
    setLoading(s => ({ ...s, [action]: true }));
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 30s')), 30000));
      const r = await Promise.race([fn(), timeout]);
      addLog(action, r);
      try { await loadStatus(); } catch (e) { addLog(action, { error: 'Status fetch: ' + e.message }); }
    } catch (e) {
      addLog(action, { error: e.message });
    }
    setLoading(s => ({ ...s, [action]: false }));
  };

  const addLog = (action, result) => {
    setLog(l => [...l.slice(-99), { action, result: result.success !== false ? 'OK' : (result.error || 'FAIL'), time: new Date().toLocaleTimeString() }]);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Controle do Servidor</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={SECTION}>
          <div style={{ color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: status?.running ? '#4caf50' : '#f44336' }}>
            {status?.running ? 'Rodando' : 'Parado'}
          </div>
          {status?.pid && <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>PID: {status.pid}</div>}
        </div>
      </div>

      <div style={{ ...SECTION }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Controles</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => act('start', () => api.startServer())} disabled={loading.start || status?.running}
            style={{ ...BTN, background: '#1a3a1a', color: '#4caf50', border: '1px solid #2a5a2a', opacity: loading.start || status?.running ? 0.5 : 1 }}>
            ▶ {loading.start ? 'Iniciando...' : 'Iniciar'}
          </button>
          <button onClick={() => act('stop', () => api.stopServer())} disabled={loading.stop || !status?.running}
            style={{ ...BTN, background: '#3a1a1a', color: '#f44336', border: '1px solid #5a2a2a', opacity: loading.stop || !status?.running ? 0.5 : 1 }}>
            ⏹ {loading.stop ? 'Parando...' : 'Parar'}
          </button>
          <button onClick={() => act('restart', () => api.restartServer())} disabled={loading.restart}
            style={{ ...BTN, background: '#3a3a1a', color: '#ffc107', border: '1px solid #5a5a2a', opacity: loading.restart ? 0.5 : 1 }}>
            🔄 {loading.restart ? 'Reiniciando...' : 'Reiniciar'}
          </button>
        </div>
      </div>

      <div style={{ ...SECTION }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Engine</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => act('save', () => api.saveServer())} disabled={loading.save}
            style={{ ...BTN, background: '#1a2a3a', color: '#7c9bff', border: '1px solid #2a3a5a', opacity: loading.save ? 0.5 : 1 }}>
            💾 {loading.save ? 'Salvando...' : 'Salvar Tudo'}
          </button>
          <button onClick={() => act('shutdown', () => api.shutdownEngine())} disabled={loading.shutdown}
            style={{ ...BTN, background: '#3a1a1a', color: '#ff7c7c', border: '1px solid #5a2a2a', opacity: loading.shutdown ? 0.5 : 1 }}>
            🔴 {loading.shutdown ? 'Desligando...' : 'Shutdown Engine'}
          </button>
        </div>
      </div>

      <div style={{ ...SECTION }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Broadcast</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
            placeholder="Mensagem para todos os players..."
            style={{ flex: 1, background: '#0f0f1a', border: '1px solid #333', color: '#e0e0e0', padding: '10px 12px', borderRadius: 4, fontSize: 13, outline: 'none' }}
            onKeyDown={e => { if (e.key === 'Enter') act('broadcast', () => api.broadcast(broadcastMsg)).then(() => setBroadcastMsg('')); }} />
          <button onClick={() => act('broadcast', () => api.broadcast(broadcastMsg)).then(() => setBroadcastMsg(''))}
            disabled={!broadcastMsg || loading.broadcast}
            style={{ ...BTN, background: '#2a2a4a', color: '#7c9bff', border: '1px solid #3a3a5a', opacity: !broadcastMsg || loading.broadcast ? 0.5 : 1 }}>
            📢 Enviar
          </button>
        </div>
      </div>

      <div style={{ ...SECTION }}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Terminal</h3>
        <Terminal logEndRef={logEndRef} />
      </div>

      <div style={SECTION}>
        <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Últimas Ações</h3>
        {log.length === 0 ? (
          <div style={{ color: '#666', fontSize: 13 }}>Nenhuma ação ainda.</div>
        ) : (
          log.slice().reverse().map((entry, i) => (
            <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #1a1a2e', display: 'flex', gap: 12 }}>
              <span style={{ color: '#555' }}>{entry.time}</span>
              <span style={{ color: '#7c9bff', textTransform: 'capitalize' }}>{entry.action}</span>
              <span style={{ color: entry.result === 'OK' ? '#4caf50' : '#ff7c7c' }}>{entry.result}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
