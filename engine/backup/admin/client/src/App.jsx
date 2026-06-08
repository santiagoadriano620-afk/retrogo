import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import PlayerDetail from './pages/PlayerDetail';
import ServerControl from './pages/ServerControl';
import SearchItem from './pages/SearchItem';
import McCheck from './pages/McCheck';
import Layout from './components/Layout';

const PAGES = {
  dashboard: Dashboard,
  players: Players,
  playerDetail: PlayerDetail,
  server: ServerControl,
  searchItem: SearchItem,
  mccheck: McCheck,
};

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    api.checkAuth().then(data => {
      setAuthenticated(data.authenticated || false);
    });
  }, []);

  if (authenticated === null) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>Carregando...</div>;
  }

  if (!authenticated) {
    return <Login onLogin={() => { setAuthenticated(true); setPage('dashboard'); }} />;
  }

  const navigate = (p, params) => {
    if (p === 'playerDetail' && params) setSelectedPlayer(params);
    setPage(p);
  };

  const PageComponent = page === 'playerDetail' ? PlayerDetail : PAGES[page] || Dashboard;

  return (
    <Layout currentPage={page} onNavigate={navigate} onLogout={() => { api.logout(); setAuthenticated(false); }}>
      {page === 'playerDetail' ? (
        <PlayerDetail playerName={selectedPlayer} onBack={() => setPage('players')} />
      ) : (
        <PageComponent onNavigate={navigate} />
      )}
    </Layout>
  );
}
