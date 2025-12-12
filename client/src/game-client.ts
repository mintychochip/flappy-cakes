import { GameMessage } from './types/game';

type EventCallback<T = any> = (data: T) => void;

export class GameClient {
    private ws: WebSocket | null = null;
    public playerId: string | null = null;
    private playerName: string | null = null;
    private roomId: string | null = null;
    private roomCode: string | null = null;
    private listeners: Map<string, EventCallback[]> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private gameStartTime: number | null = null;
    private pipesPassed = 0;
    public skinId: string = 'character1';

    on<T = any>(event: string, callback: EventCallback<T>) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    off(event: string, callback?: EventCallback) {
        if (!callback) {
            // Remove all listeners for this event
            this.listeners.delete(event);
        } else {
            // Remove specific callback
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }
    }

    removeAllListeners() {
        this.listeners.clear();
    }

    private emit<T = any>(event: string, data: T) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }

    disconnect() {
        this.removeAllListeners();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    getGameDuration(): number {
        if (!this.gameStartTime) return 0;
        return Math.floor((Date.now() - this.gameStartTime) / 1000);
    }

    getPipesPassed(): number {
        return this.pipesPassed;
    }

    connect(url: string, roomCode?: string, playerName?: string, skinId?: string) {
        if (roomCode) {
            this.roomCode = roomCode;
        }
        if (playerName) {
            this.playerName = playerName;
        }
        if (skinId) {
            this.skinId = skinId;
        } else if (typeof window !== 'undefined') {
            // Fallback to localStorage if no skinId provided
            const savedSkin = localStorage.getItem('flappySkin');
            if (savedSkin) {
                this.skinId = savedSkin;
            }
        }

        // Use base WebSocket URL - room code is sent in the message
        const wsUrl = url;

        console.log(`🔌 GameClient.connect() called - roomCode: ${roomCode}, playerName: ${playerName}, skinId: ${skinId}, existing playerId: ${this.playerId}`);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to server, sending join message...');
                console.log('🎨 Join message data:', {
                    type: 'join',
                    roomCode: this.roomCode,
                    playerName: this.playerName || 'Anonymous',
                    skinId: this.skinId
                });
                this.reconnectAttempts = 0;
                this.send({
                    type: 'join',
                    roomCode: this.roomCode,
                    playerName: this.playerName || 'Anonymous',
                    skinId: this.skinId
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error('Failed to parse message:', err);
                }
            };

            this.ws.onerror = (err) => {
                console.error('WebSocket error:', err);
            };

            this.ws.onclose = () => {
                console.log('Disconnected from server');
                this.attemptReconnect(url);
            };
        } catch (err) {
            console.error('Failed to connect:', err);
            this.attemptReconnect(url);
        }
    }

    private attemptReconnect(url: string) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            setTimeout(() => this.connect(url, this.roomCode || undefined), delay);
        }
    }

    private handleMessage(data: GameMessage) {
        switch (data.type) {
            case 'joined':
                this.playerId = data.playerId;
                this.roomId = data.roomId;
                this.emit('joined', data);
                break;
            case 'gameStart':
                this.gameStartTime = Date.now();
                this.pipesPassed = 0;
                this.emit('gameStart', data);
                break;
            case 'gameState':
                // Track pipes passed for analytics
                const myPlayer = data.players.find(p => p.id === this.playerId);
                if (myPlayer) {
                    this.pipesPassed = Math.floor(myPlayer.score / 100);
                }
                this.emit('gameState', data);
                break;
            case 'playerJoined':
                this.emit('playerJoined', data);
                break;
            case 'playerLeft':
                this.emit('playerLeft', data);
                break;
            case 'gameOver':
                this.emit('gameOver', data);
                break;
        }
    }

    send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('📤 Sending message:', message);
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('❌ Cannot send message - WebSocket not ready. State:', this.ws?.readyState);
        }
    }

    sendInput(jumping: boolean) {
        this.send({
            type: 'input',
            jumping: jumping
        });
    }

    ping() {
        this.send({ type: 'ping' });
    }
}
