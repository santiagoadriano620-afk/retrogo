const BASE = '/api/admin';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok && !data.error) data.error = 'Request failed';
  return data;
}

export const api = {
  login: (account, password) => request('POST', '/login', { account, password }),
  logout: () => request('POST', '/logout'),
  checkAuth: () => request('GET', '/check'),

  getDashboard: () => request('GET', '/dashboard'),

  getPlayers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', '/players' + (qs ? '?' + qs : ''));
  },
  getOnlinePlayers: () => request('GET', '/players/online'),
  getPlayer: (name) => request('GET', '/players/' + encodeURIComponent(name)),
  getPlayerDepot: (name) => request('GET', '/players/' + encodeURIComponent(name) + '/depot'),
  setLevel: (name, level) => request('PUT', '/players/' + encodeURIComponent(name) + '/level', { level }),
  setSkills: (name, skills) => request('PUT', '/players/' + encodeURIComponent(name) + '/skills', skills),
  setProperty: (name, key, value) => request('PUT', '/players/' + encodeURIComponent(name) + '/property', { key, value }),
  kickPlayer: (name) => request('DELETE', '/players/' + encodeURIComponent(name) + '/kick'),
  setPremiumPoints: (name, amount) => request('PUT', '/players/' + encodeURIComponent(name) + '/premium', { amount }),
  searchItem: (itemId) => request('GET', '/players/search-item?itemId=' + itemId),

  getServerStatus: () => request('GET', '/server/status'),
  startServer: () => request('POST', '/server/start'),
  stopServer: () => request('POST', '/server/stop'),
  restartServer: () => request('POST', '/server/restart'),
  saveServer: () => request('POST', '/server/save'),
  shutdownEngine: () => request('POST', '/server/shutdown'),
  broadcast: (message) => request('POST', '/server/broadcast', { message }),

  scanMcCheck: () => request('GET', '/mccheck/scan'),
};
