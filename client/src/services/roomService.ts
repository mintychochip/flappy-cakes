const GET_ROOM_URL = 'https://getroom-bfuiaay2bq-uc.a.run.app';

export interface Room {
  code: string;
  hostId: string;
  players: Record<string, {
    id: string;
    name: string;
    joinedAt: number;
    isHost: boolean;
  }>;
  state: 'waiting' | 'playing' | 'finished';
  createdAt: number;
}

export async function getRoom(code: string): Promise<Room> {
  const response = await fetch(GET_ROOM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get room');
  }

  return response.json();
}