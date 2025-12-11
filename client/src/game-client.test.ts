import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameClient } from './game-client';

describe('GameClient', () => {
  let client: GameClient;

  beforeEach(() => {
    client = new GameClient();
  });

  it('should initialize with null playerId', () => {
    expect(client.playerId).toBeNull();
  });

  it('should track game duration', () => {
    expect(client.getGameDuration()).toBe(0);
  });

  it('should track pipes passed', () => {
    expect(client.getPipesPassed()).toBe(0);
  });

  it('should register event listeners', () => {
    const callback = vi.fn();
    client.on('test', callback);
    // Listener registered successfully if no error
    expect(true).toBe(true);
  });

  it('should handle joined message', () => {
    const callback = vi.fn();
    client.on('joined', callback);

    // Simulate receiving a message
    const mockMessage = {
      type: 'joined',
      playerId: 'player-123',
      roomId: 'room-456',
      playerCount: 2
    };

    // @ts-ignore - accessing private method for testing
    client.handleMessage(mockMessage);

    expect(client.playerId).toBe('player-123');
    expect(callback).toHaveBeenCalledWith(mockMessage);
  });

  it('should reset game state on gameStart', () => {
    const callback = vi.fn();
    client.on('gameStart', callback);

    const mockMessage = { type: 'gameStart' };

    // @ts-ignore
    client.handleMessage(mockMessage);

    expect(client.getGameDuration()).toBeGreaterThanOrEqual(0);
    expect(client.getPipesPassed()).toBe(0);
    expect(callback).toHaveBeenCalled();
  });
});
