import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const VOCATIONS = ['None', 'Sorcerer', 'Druid', 'Paladin', 'Knight'];

const SLOT_NAMES = ['Head', 'Amulet', 'Backpack', 'Armor', 'Right Hand', 'Left Hand', 'Legs', 'Boots', 'Ring', 'Ammo'];

const INPUT = {
  background: '#0f0f1a', border: '1px solid #333', color: '#e0e0e0', padding: '8px 10px',
  borderRadius: 4, fontSize: 13, outline: 'none'
};

const SECTION = { background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', padding: 20, marginBottom: 16 };

function ItemIcon({ id, size }) {
  const s = size || 40;
  const [error, setError] = React.useState(false);
  if (!id || error) {
    return (
      <div style={{
        width: s, height: s, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: s > 30 ? 10 : 7, fontWeight: 'bold', color: '#555', flexShrink: 0,
        background: '#0a0a14', border: '1px solid #1a1a2e'
      }}>
        ?
      </div>
    );
  }
  return (
    <div style={{
      width: s, height: s, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, background: '#0f0f1a', border: '1px solid #1a1a2e',
      position: 'relative', overflow: 'hidden'
    }}>
      <img
        src={'/api/admin/sprites/' + id}
        alt={'Item ' + id}
        style={{ width: s, height: s, objectFit: 'contain', imageRendering: 'pixelated' }}
        onError={() => setError(true)}
      />
    </div>
  );
}

function ItemRow({ item, depth }) {
  if (!item) return null;
  const d = depth || 0;
  const id = item.id || item.itemId || 0;
  const name = item.name || 'Unknown';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', paddingLeft: d * 16 }}>
        <ItemIcon id={id} size={28} />
        <div style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {name}
          </span>
          <span style={{ fontSize: 10, color: '#666' }}>ID: {id}{item.count > 1 ? ` x${item.count}` : ''}</span>
        </div>
      </div>
      {item.contents && item.contents.filter(Boolean).map((sub, i) => (
        <ItemRow key={i} item={sub} depth={d + 1} />
      ))}
    </div>
  );
}

function SlotBox({ slotIndex, item, slotNames }) {
  const empty = !item;
  return (
    <div style={{
      background: empty ? '#0a0a14' : '#0f0f1a',
      border: '1px solid ' + (empty ? '#1a1a2e' : '#2a2a4a'),
      borderRadius: 6, padding: 6, minHeight: 70
    }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 4, textTransform: 'uppercase', textAlign: 'center' }}>
        {slotNames[slotIndex] || `Slot ${slotIndex}`}
      </div>
      {empty ? (
        <div style={{ fontSize: 11, color: '#444', textAlign: 'center', padding: '12px 0' }}>—</div>
      ) : (
        <ItemRow item={item} />
      )}
    </div>
  );
}

function EquipmentGrid({ equipment }) {
  const eq = equipment || new Array(10).fill(null);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
      {eq.map((item, i) => (
        <SlotBox key={i} slotIndex={i} item={item} slotNames={SLOT_NAMES} />
      ))}
    </div>
  );
}

function flattenEquipment(arr) {
  if (!arr || !Array.isArray(arr)) return new Array(10).fill(null);
  return arr.map(function (item) {
    if (!item) return null;
    if (typeof item === 'number') return { id: item, name: 'Unknown' };
    const id = item.id || item.itemId || 0;
    const base = {
      id: id,
      count: item.count || 1,
      name: item.name || 'Unknown'
    };
    const children = item.items || item.contents;
    if (children && Array.isArray(children)) {
      base.container = true;
      base.contents = children.map(function (sub) {
        if (!sub) return null;
        const subId = sub.id || sub.itemId || 0;
        return { id: subId, count: sub.count || sub.amount || 1, name: sub.name || 'Unknown' };
      }).filter(Boolean);
    }
    return base;
  });
}

export default function PlayerDetail({ playerName, onBack }) {
  const [player, setPlayer] = useState(null);
  const [depotData, setDepotData] = useState(null);
  const [tab, setTab] = useState('info');
  const [msg, setMsg] = useState('');
  const [banDays, setBanDays] = useState('7');
  const [banReason, setBanReason] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, d] = await Promise.all([api.getPlayer(playerName), api.getPlayerDepot(playerName)]);
    setPlayer(p);
    setDepotData(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, [playerName]);

  if (!player) return <div style={{ color: '#888' }}>Carregando...</div>;

  const { properties, computedSkills } = player;
  const isBanned = player.ban && player.ban.active;
  const rawData = player.data || {};
  const containers = rawData.containers || {};
  const equipment = flattenEquipment(containers.equipment);

  const setLevel = async () => {
    const l = prompt('Novo level (1-1000):', player.level);
    if (!l) return;
    const r = await api.setLevel(playerName, parseInt(l));
    setMsg(r.success ? 'Level atualizado!' : r.error);
    if (r.success) load();
  };

  const setSkill = async (sk) => {
    const current = computedSkills?.[sk] ?? 0;
    const v = prompt(`Novo nivel da skill ${sk} (atual: ${current}):`, current);
    if (!v) return;
    const r = await api.setSkills(playerName, { [sk]: parseInt(v) });
    setMsg(r.success ? 'Skill atualizada!' : r.error);
    if (r.success) load();
  };

  const kick = async () => {
    const r = await api.kickPlayer(playerName);
    setMsg(r.success ? 'Jogador desconectado!' : (r.offline ? 'Engine offline' : 'Falha ao kickar'));
  };

  const handleBan = async () => {
    if (!banDays || parseInt(banDays) < 0) { setMsg('Dias inválido'); return; }
    const r = await fetch('/api/admin/players/' + encodeURIComponent(playerName) + '/ban', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ days: parseInt(banDays), reason: banReason })
    }).then(r => r.json());
    setMsg(r.success ? 'Jogador banido!' : r.error);
    if (r.success) load();
  };

  const handleUnban = async () => {
    const r = await fetch('/api/admin/players/' + encodeURIComponent(playerName) + '/unban', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
    }).then(r => r.json());
    setMsg(r.success ? 'Jogador desbanido!' : r.error);
    if (r.success) load();
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{
          background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
          padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13
        }}>← Voltar</button>
        <h2>{player.name || playerName}</h2>
        <span style={{ color: '#888', fontSize: 13 }}>Level {player.level} {VOCATIONS[player.vocation]}</span>
        {isBanned && <span style={{ color: '#f44336', fontSize: 12, background: '#3a1a1a', padding: '2px 8px', borderRadius: 4 }}>BANIDO</span>}
        <button onClick={load} style={{
          background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
          padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, marginLeft: 'auto'
        }}>{loading ? '🔄' : '🔄 Recarregar'}</button>
      </div>

      {msg && <div style={{
        background: msg.includes('erro') || msg.includes('inválido') || msg.includes('Falha') ? '#3a1a1a' : '#1a3a1a',
        color: msg.includes('erro') || msg.includes('inválido') || msg.includes('Falha') ? '#ff7c7c' : '#7cff7c',
        padding: '8px 12px', borderRadius: 4, marginBottom: 16, fontSize: 13
      }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          ['info', 'Info'], ['inventory', 'Inventário'], ['depot', 'Depot'], ['actions', 'Ações']
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: tab === key ? '#2a2a4a' : 'transparent',
            border: '1px solid #3a3a5a', color: tab === key ? '#fff' : '#999',
            padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13
          }}>{label}</button>
        ))}
      </div>

      {tab === 'info' && (
        <>
          <div style={SECTION}>
            <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Propriedades</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {[
                  ['Level', player.level],
                  ['Experience', (player.rawSkills?.experience || 0).toLocaleString()],
                  ['Vocation', VOCATIONS[player.vocation] || player.vocation],
                  ['Sex', properties?.sex === 1 ? 'Male' : 'Female'],
                  ['Health', properties ? `${properties.health}/${properties.healthMax}` : '-'],
                  ['Mana', properties ? `${properties.mana}/${properties.manaMax}` : '-'],
                  ['Capacity', properties?.capacity ?? '-'],
                  ['Speed', properties?.speed ?? '-'],
                  ['Premium Points', player.premiumPoints ?? 0],
                ].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ padding: '8px 4px', color: '#888' }}>{k}</td>
                    <td style={{ padding: '8px 4px' }}>{v ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={SECTION}>
            <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Skills</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#888', borderBottom: '1px solid #2a2a4a' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>Skill</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>Nível</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Magic', 'magic'], ['Fist', 'fist'], ['Club', 'club'], ['Sword', 'sword'],
                  ['Axe', 'axe'], ['Distance', 'distance'], ['Shielding', 'shielding'], ['Fishing', 'fishing']
                ].map(([label, key]) => (
                  <tr key={key} style={{ borderBottom: '1px solid #1a1a2e' }}>
                    <td style={{ padding: '8px 4px' }}>{label}</td>
                    <td style={{ padding: '8px 4px', fontWeight: 600, color: '#7c9bff' }}>{computedSkills?.[key] ?? 0}</td>
                    <td style={{ padding: '8px 4px' }}>
                      <button onClick={() => setSkill(key)} style={{
                        background: 'transparent', border: '1px solid #3a3a5a', color: '#7c9bff',
                        padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11
                      }}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'inventory' && (
        <div style={SECTION}>
          <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Equipamento</h3>
          <EquipmentGrid equipment={equipment} />
        </div>
      )}

      {tab === 'depot' && (
        <div style={SECTION}>
          <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Depot</h3>
          {depotData && depotData.storage ? (
            depotData.storage.map((s, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#7c9bff' }}>{s.label}</div>
                {(!s.items || s.items.length === 0) ? (
                  <div style={{ color: '#555', fontSize: 12 }}>Vazio</div>
                ) : (
                  s.items.filter(Boolean).map((item, j) => (
                    <ItemRow key={j} item={item} />
                  ))
                )}
              </div>
            ))
          ) : (
            <div style={{ color: '#666', fontSize: 13 }}>Nenhum item no depot.</div>
          )}
        </div>
      )}

      {tab === 'actions' && (
        <div style={SECTION}>
          <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>Ações</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            <button onClick={setLevel} style={{
              background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
              padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 14
            }}>⭐ Dar Level</button>
            <button onClick={async () => {
              const v = prompt('Vocation (0=None, 1=Sorcerer, 2=Druid, 3=Paladin, 4=Knight):');
              if (!v) return;
              const r = await api.setProperty(playerName, 'vocation', parseInt(v));
              setMsg(r.success ? 'Vocation alterada!' : r.error);
              if (r.success) load();
            }} style={{
              background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
              padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 14
            }}>🔄 Mudar Vocation</button>
            <button onClick={async () => {
              const r = await api.setProperty(playerName, 'sex', properties?.sex === 1 ? 0 : 1);
              setMsg(r.success ? 'Sexo alterado!' : r.error);
              if (r.success) load();
            }} style={{
              background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#7c9bff',
              padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 14
            }}>⚤ Mudar Sexo</button>
            <button onClick={kick} style={{
              background: '#3a1a1a', border: '1px solid #5a2a2a', color: '#ff7c7c',
              padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 14
            }}>🔌 Kickar</button>
            <button onClick={async () => {
              const current = player.premiumPoints ?? 0;
              const v = prompt(`Premium points (atual: ${current})\nValor positivo = adicionar\nValor negativo = remover:`, '0');
              if (!v) return;
              const amount = parseInt(v, 10);
              if (isNaN(amount) || amount === 0) { setMsg('Valor inválido'); return; }
              const r = await api.setPremiumPoints(playerName, amount);
              setMsg(r.success ? `Premium points atualizado! Saldo: ${r.premiumPoints}` : (r.error || 'Erro'));
              if (r.success) load();
            }} style={{
              background: '#2a2a4a', border: '1px solid #3a3a5a', color: '#ffd700',
              padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontSize: 14
            }}>⭐ Premium Points</button>
          </div>

          <h3 style={{ fontSize: 14, color: '#888', marginBottom: 12, textTransform: 'uppercase' }}>
            {isBanned ? 'Banimento Ativo' : 'Banir Jogador'}
          </h3>

          {isBanned ? (
            <div style={{ background: '#3a1a1a', borderRadius: 4, padding: 16, border: '1px solid #5a2a2a' }}>
              <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Motivo:</strong> {player.ban.reason || 'Sem motivo'}</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Duração:</strong> {player.ban.days > 0 ? player.ban.days + ' dias' : 'Permanente'}</div>
              {player.ban.expires_at > 0 && (
                <div style={{ fontSize: 13, marginBottom: 8 }}><strong>Expira em:</strong> {new Date(player.ban.expires_at).toLocaleString()}</div>
              )}
              <button onClick={handleUnban} style={{
                background: '#1a3a1a', border: '1px solid #2a5a2a', color: '#4caf50',
                padding: '10px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 14, marginTop: 8
              }}>✅ Desbanir</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#888', width: 80 }}>Duração:</span>
                <input style={{ ...INPUT, width: 80 }} type="number" min="0" value={banDays} onChange={e => setBanDays(e.target.value)} />
                <span style={{ fontSize: 12, color: '#666' }}>dias (0 = permanente)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#888', width: 80 }}>Motivo:</span>
                <input style={{ ...INPUT, flex: 1 }} placeholder="Ex: Uso de cheats..." value={banReason} onChange={e => setBanReason(e.target.value)} />
              </div>
              <button onClick={handleBan} style={{
                background: '#3a1a1a', border: '1px solid #5a2a2a', color: '#ff7c7c',
                padding: '10px 24px', borderRadius: 4, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start', marginTop: 4
              }}>🔨 Banir</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
