import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

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

export function subscribeToRoom(
  roomCode: string,
  onUpdate: (room: Room) => void,
  onError?: (error: Error) => void
): () => void {
  const roomRef = doc(db, 'rooms', roomCode.toUpperCase());

  const unsubscribe = onSnapshot(
    roomRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Room;
        onUpdate(data);
      } else if (onError) {
        onError(new Error('Room not found'));
      }
    },
    (error) => {
      console.error('Firestore subscription error:', error);
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}