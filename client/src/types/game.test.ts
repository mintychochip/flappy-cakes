import { describe, it, expect } from 'vitest';
import type { GameOverMessage, GameAnalytics } from './game';

describe('Type interfaces', () => {
  it('should validate GameOverMessage structure', () => {
    const message: GameOverMessage = {
      type: 'gameOver',
      winner: 'player-1',
      finalScores: [
        { id: 'player-1', score: 1000 },
        { id: 'player-2', score: 500 },
      ],
      stats: {
        totalPlayers: 2,
        gameDuration: 45,
        topScore: 1000,
      },
    };

    expect(message.type).toBe('gameOver');
    expect(message.finalScores).toHaveLength(2);
    expect(message.stats.totalPlayers).toBe(2);
  });

  it('should validate GameAnalytics structure', () => {
    const analytics: GameAnalytics = {
      placement: 1,
      totalPlayers: 10,
      finalScore: 2500,
      survived: 120,
      pipesCleared: 25,
    };

    expect(analytics.placement).toBe(1);
    expect(analytics.finalScore).toBe(2500);
  });
});
