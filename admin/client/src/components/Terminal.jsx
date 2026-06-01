import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const LEVEL_COLORS = {
  info: '#7c9bff',
  stdout: '#e0e0e0',
  stderr: '#ff7c7c',
  warn: '#ffc107',
  error: '#f44336'
};

export default function Terminal({ logEndRef }) {
  const [lines, setLines] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io({ transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('terminal', function (data) {
      setLines(prev => [...prev.slice(-499), data]);
    });

    socket.on('server-status', function (status) {
      setLines(prev => [...prev.slice(-499), {
        level: 'info',
        message: `Server status: ${status.running ? 'Rodando (PID: ' + status.pid + ')' : 'Parado'}`,
        timestamp: Date.now()
      }]);
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    if (logEndRef && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines]);

  return (
    <div style={{
      background: '#0a0a14', borderRadius: 4, padding: 12,
      fontFamily: "'Courier New', monospace", fontSize: 12,
      maxHeight: 400, overflow: 'auto', border: '1px solid #1a1a2e'
    }}>
      {lines.length === 0 && (
        <div style={{ color: '#555', fontStyle: 'italic' }}>Aguardando logs do servidor...</div>
      )}
      {lines.map((line, i) => (
        <div key={i} style={{
          color: LEVEL_COLORS[line.level] || '#e0e0e0',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          padding: '1px 0', lineHeight: 1.4
        }}>
          <span style={{ color: '#555', marginRight: 8 }}>
            {new Date(line.timestamp || Date.now()).toLocaleTimeString()}
          </span>
          {line.message.replace(/\x1b\[[0-9;]*m/g, '')}
        </div>
      ))}
      <div ref={logEndRef} />
    </div>
  );
}
