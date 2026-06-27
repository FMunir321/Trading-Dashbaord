export function connectWebSocket(url: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return new WebSocket(url);
  } catch {
    return null;
  }
}
