import { io } from 'socket.io-client';

// ── IMPORTANT: Update this URL to your server's address ──
// For local development with Android emulator: 'http://10.0.2.2:3000'
// For local development with iOS simulator: 'http://localhost:3000'
// For physical device on same WiFi: 'http://<YOUR_PC_IP>:3000'
// For production: your deployed server URL
const SERVER_URL = 'http://192.168.0.103:3000';

let socket = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(SERVER_URL, {
            transports: ['websocket'],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
    }
    return socket;
};

export const connectSocket = (userData) => {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
        s.on('connect', () => {
            console.log('🔌 Connected to duel server:', s.id);
            // Register player with server
            s.emit('register', {
                userId: userData.uid || userData.userId,
                username: userData.username || 'Player',
                rank: userData.rank || 'Bronze',
            });
        });
        s.on('connect_error', (err) => {
            console.log('❌ Socket connection error:', err.message);
        });
    }
    return s;
};

export const disconnectSocket = () => {
    if (socket && socket.connected) {
        socket.disconnect();
    }
};

export default { getSocket, connectSocket, disconnectSocket };
