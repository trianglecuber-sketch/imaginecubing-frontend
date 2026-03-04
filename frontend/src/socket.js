import { io } from 'socket.io-client';

// ── Change this to your Render backend URL after deploying ────────────────────
// Example: const BACKEND = 'https://cuberace-backend.onrender.com'
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export const API = BACKEND;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(BACKEND, { autoConnect: false, reconnection: true, reconnectionDelay: 1000 });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) socket.disconnect();
}

export async function apiPost(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function apiGet(path) {
  const res = await fetch(`${BACKEND}${path}`);
  return res.json();
}
