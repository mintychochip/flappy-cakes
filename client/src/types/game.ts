// Game message types
export interface Player {
  id: string;
  name?: string;
  y: number;
  alive: boolean;
  score: number;
  skinId?: string;
  jumping?: boolean;
}

export interface Pipe {
  x: number;
  gapY: number;
  gapHeight: number;
}

export interface GameStateMessage {
  type: 'gameState';
  players: Player[];
  pipes: Pipe[];
}

export interface JoinedMessage {
  type: 'joined';
  playerId: string;
  roomId: string;
  playerCount: number;
  existingPlayers?: Array<{ id: string }>;
}

export interface GameStartMessage {
  type: 'gameStart';
}

export interface GameOverMessage {
  type: 'gameOver';
  winner: string;
  finalScores: Array<{
    id: string;
    name?: string;
    score: number;
  }>;
  stats: {
    totalPlayers: number;
    gameDuration: number;
    topScore: number;
  };
}

export interface PlayerJoinedMessage {
  type: 'playerJoined';
  playerId: string;
  playerCount: number;
}

export interface PlayerLeftMessage {
  type: 'playerLeft';
  playerId: string;
  playerCount: number;
}

export type GameMessage =
  | GameStateMessage
  | JoinedMessage
  | GameStartMessage
  | GameOverMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage;

// Analytics data
export interface GameAnalytics {
  placement: number;
  totalPlayers: number;
  finalScore: number;
  survived: number; // seconds
  pipesCleared: number;
}
