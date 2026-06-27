'use client';

import { useEffect, useState } from 'react';
import { connectWebSocket } from '@/app/lib/ws';

export function useWebSocket() {
  const [status, setStatus] = useState('disconnected');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = connectWebSocket('wss://echo.websocket.events');

    if (!socket) {
      setStatus('unsupported');
      setMessage('WebSocket is not available in this browser.');
      return;
    }

    setStatus('connecting');

    socket.onopen = () => {
      setStatus('connected');
      setMessage('Live market updates are available.');
      socket.send('ping');
    };

    socket.onmessage = event => {
      setMessage(event.data?.toString() ?? 'Incoming update');
    };

    socket.onerror = () => {
      setStatus('error');
      setMessage('Unable to connect to the live feed.');
    };

    socket.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      socket.close();
    };
  }, []);

  return { status, message };
}
