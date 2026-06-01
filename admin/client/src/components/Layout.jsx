import React from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'players', label: 'Players', icon: '👤' },
  { id: 'searchItem', label: 'Search Item', icon: '🔍' },
  { id: 'mccheck', label: 'MC Check', icon: '🛡️' },
  { id: 'server', label: 'Servidor', icon: '🖥️' },
];

const SIDEBAR_STYLE = {
  width: 220, height: '100vh', background: '#1a1a2e', display: 'flex',
  flexDirection: 'column', borderRight: '1px solid #2a2a4a', position: 'fixed', left: 0, top: 0
};

const CONTENT_STYLE = { marginLeft: 220, padding: 24, minHeight: '100vh' };

export default function Layout({ children, currentPage, onNavigate, onLogout }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={SIDEBAR_STYLE}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #2a2a4a' }}>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#7c9bff' }}>TibiaJS</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Admin Panel</div>
        </div>
        <div style={{ flex: 1, padding: '12px 0' }}>
          {NAV_ITEMS.map(item => (
            <div key={item.id} onClick={() => onNavigate(item.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                background: currentPage === item.id ? '#2a2a4a' : 'transparent',
                borderLeft: currentPage === item.id ? '3px solid #7c9bff' : '3px solid transparent',
                color: currentPage === item.id ? '#fff' : '#999', fontSize: 14
              }}
              onMouseEnter={e => { if (currentPage !== item.id) e.target.style.background = '#222240'; }}
              onMouseLeave={e => { if (currentPage !== item.id) e.target.style.background = 'transparent'; }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #2a2a4a' }}>
          <button onClick={onLogout} style={{
            width: '100%', padding: '8px 0', background: '#3a1a1a', border: '1px solid #5a2a2a',
            color: '#ff7c7c', borderRadius: 4, cursor: 'pointer', fontSize: 13
          }}>Sair</button>
        </div>
      </div>
      <div style={CONTENT_STYLE}>{children}</div>
    </div>
  );
}
