import React, { useState } from 'react';
import { api } from '../api/client';

const FLAG_LABELS = {
  vpn: { label: 'VPN / Datacenter', color: '#ff6b6b' },
  shared_online: { label: 'Multi-client (online)', color: '#ffa94d' },
  shared_reg: { label: 'Mesmo IP cadastro', color: '#ffd43b' },
};

export default function McCheck({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.scanMcCheck();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>MC Check</h2>
        <button onClick={scan} disabled={loading} style={{
          background: loading ? '#333' : '#2a2a4a',
          border: '1px solid #3a3a5a',
          color: loading ? '#666' : '#7c9bff',
          padding: '10px 24px',
          borderRadius: 4,
          cursor: loading ? 'default' : 'pointer',
          fontSize: 14,
          fontWeight: 'bold'
        }}>
          {loading ? 'Escaneando...' : '🔍 Escanear'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#2a1a1a', border: '1px solid #5a2a2a', color: '#ff7c7c', padding: '12px 16px', borderRadius: 4, marginBottom: 16 }}>
          Erro: {error}
        </div>
      )}

      {data && data.engineError && (
        <div style={{ background: '#1a0a0a', border: '1px solid #5a2a2a', color: '#ff6b6b', padding: '12px 16px', borderRadius: 4, marginBottom: 16 }}>
          <strong>⚠️ Engine offline / erro de conexão</strong>
          <div style={{ fontSize: 12, marginTop: 4, color: '#ff9999' }}>{data.engineError}</div>
          <div style={{ fontSize: 11, marginTop: 8, color: '#888' }}>
            O scan de IPs online depende do engine admin API (porta 2224). Dados de IP de cadastro continuam disponíveis.
          </div>
        </div>
      )}

      {data && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Total Clusters</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>{data.summary.totalClusters}</div>
          </div>
          <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #5a2a2a', padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>VPN Detectado</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff6b6b' }}>{data.summary.vpnDetected}</div>
          </div>
          <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Multi-Client (Online)</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ffa94d' }}>{data.summary.sharedOnlineIps}</div>
          </div>
          <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Mesmo IP Cadastro</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ffd43b' }}>{data.summary.sharedRegIps}</div>
          </div>
          <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: '12px 20px', flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase' }}>Online Agora</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4caf50' }}>{data.summary.totalOnline}</div>
          </div>
        </div>
      )}

      {data && data.summary.totalOnline === 0 && !data.engineError && (
        <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', color: '#999', padding: '12px 16px', borderRadius: 4, marginBottom: 16, fontSize: 12 }}>
          Nenhum player online no momento.
        </div>
      )}

      {data && data.clusters.length === 0 && (
        <div style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: 24, textAlign: 'center', color: '#888' }}>
          {data.summary.totalOnline > 0 ? 'Nenhum cluster suspeito encontrado.' : (data.engineError ? 'Não foi possível verificar IPs online.' : 'Nenhum dado de IP disponível para gerar clusters.')}
        </div>
      )}

      {data && data.clusters.map((cluster, idx) => (
        <div key={idx} style={{ background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', marginBottom: 12, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid #2a2a4a',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: cluster.flag === 'vpn' ? '#1a0a0a' : '#141428'
          }}>
            <div>
              <strong style={{ color: '#fff', fontSize: 14 }}>{cluster.ip}</strong>
              {cluster.flag && (
                <span style={{
                  marginLeft: 10, fontSize: 11, padding: '2px 8px', borderRadius: 3,
                  background: (FLAG_LABELS[cluster.flag]?.color || '#666') + '22',
                  border: '1px solid ' + (FLAG_LABELS[cluster.flag]?.color || '#666'),
                  color: FLAG_LABELS[cluster.flag]?.color || '#fff'
                }}>
                  {FLAG_LABELS[cluster.flag]?.label || cluster.flag}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {cluster.online.length > 0 && (
                <span style={{ color: '#4caf50', marginRight: 12 }}>{cluster.online.length} online</span>
              )}
              <span>{cluster.accounts.length} contas</span>
            </div>
          </div>

          {cluster.isp && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: '#666', borderBottom: '1px solid #1a1a2e', background: '#0f0f1a' }}>
              {cluster.isp}{cluster.org ? ' / ' + cluster.org : ''}{cluster.country ? ' • ' + cluster.country : ''}{cluster.city ? ', ' + cluster.city : ''}
            </div>
          )}

          <div style={{ padding: 8 }}>
            {cluster.accounts.map((acc, ai) => (
              <div key={ai} style={{
                padding: '8px 8px', borderBottom: ai < cluster.accounts.length - 1 ? '1px solid #1a1a2e' : 'none',
                fontSize: 13
              }}>
                <div style={{ color: '#7c9bff', fontSize: 12, marginBottom: 4 }}>
                  Account: {acc.accountId}{acc.accountName ? ' (' + acc.accountName + ')' : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(acc.chars || []).map(function (ch, ci) {
                    const isOnline = (acc.onlineChars || []).indexOf(ch) !== -1;
                    return (
                      <span key={ci} onClick={() => isOnline ? onNavigate('playerDetail', ch) : null}
                        style={{
                          background: isOnline ? '#1a3a1a' : '#1a1a2e',
                          border: '1px solid ' + (isOnline ? '#2a5a2a' : '#2a2a4a'),
                          color: isOnline ? '#4caf50' : '#999',
                          padding: '2px 10px', borderRadius: 3, fontSize: 12, cursor: isOnline ? 'pointer' : 'default'
                        }}>
                        {ch} {isOnline ? '(online)' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}

            {cluster.online.map(function (o, oi) {
              const found = cluster.accounts.some(function (a) {
                return (a.chars || []).indexOf(o.name) !== -1;
              });
              if (found) return null;
              return (
                <div key={'miss-' + oi} style={{ padding: '6px 8px', fontSize: 12, color: '#ff6b6b' }}>
                  ⚠ {o.name} (Level {o.level}) — Online sem conta registrada neste IP
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {data && data.clusters.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: '#0f0f1a', borderRadius: 4, border: '1px solid #1a1a2e', fontSize: 11, color: '#666' }}>
          <strong>Legenda:</strong>
          <span style={{ marginLeft: 8, color: '#ff6b6b' }}>VPN/Datacenter</span>
          <span style={{ marginLeft: 8, color: '#ffa94d' }}>Multi-client online</span>
          <span style={{ marginLeft: 8, color: '#ffd43b' }}>Mesmo IP de cadastro</span>
          <span style={{ marginLeft: 8, color: '#4caf50' }}>Online agora</span>
          <span style={{ marginLeft: 8, color: '#ff6b6b' }}>⚠ Online sem conta vinculada</span>
        </div>
      )}
    </div>
  );
}
