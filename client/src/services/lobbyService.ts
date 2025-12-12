const API_BASE = 'https://createroom-bfuiaay2bq-uc.a.run.app';
const CREATE_ROOM_URL = 'https://createroom-bfuiaay2bq-uc.a.run.app';
const JOIN_ROOM_URL = 'https://joinroom-bfuiaay2bq-uc.a.run.app';
const LEAVE_ROOM_URL = 'https://leaveroom-bfuiaay2bq-uc.a.run.app';

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
  isHost: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  players: Record<string, Player>; // Changed from array to object
  state: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}

export interface CreateRoomResponse {
  code: string;
  hostId: string;
  players: Record<string, Player>;
  state: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}

export interface JoinRoomResponse {
  playerId: string;
  room: Room;
}

export async function createRoom(hostName?: string): Promise<CreateRoomResponse> {
  const savedName = hostName || localStorage.getItem('flappyPlayerName') || 'Host';

  const response = await fetch(CREATE_ROOM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName: savedName })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create room');
  }

  return response.json();
}

export async function joinRoom(code: string, playerName?: string): Promise<JoinRoomResponse> {
  const savedName = playerName || localStorage.getItem('flappyPlayerName') || 'Anonymous';

  const response = await fetch(JOIN_ROOM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, playerName: savedName })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join room');
  }

  return response.json();
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  const response = await fetch(LEAVE_ROOM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, playerId })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to leave room');
  }
}
