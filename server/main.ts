const PORT = parseInt(Deno.env.get("PORT") || "8080");

// Game constants (must match client)
const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const PIPE_WIDTH = 120;
const PIPE_GAP = 200;
const PIPE_SPEED = 3;
const GRAVITY = 0.25;
const JUMP_POWER = -6;
const TICK_RATE = 60; // 60 ticks per second

interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  score: number;
  alive: boolean;
  y: number;
  velocityY: number;
  jumping: boolean; // Current input state
}

interface Pipe {
  x: number;
  gapY: number;
  scored: Set<string>; // Track which players scored on this pipe
}

interface GameRoom {
  id: string;
  code: string; // 4-letter room code
  players: Map<string, Player>;
  state: "waiting" | "playing" | "finished";
  pipes: Pipe[];
  pipeCounter: number;
  gameLoop?: number;
  windowHeight: number;
  gameStartTime?: number;
}

const rooms = new Map<string, GameRoom>();

function broadcast(room: GameRoom, message: unknown, exclude?: string) {
  const msg = JSON.stringify(message);
  for (const [id, player] of room.players) {
    if (id !== exclude && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(msg);
    }
  }
}

function checkCollision(player: Player, pipes: Pipe[], windowHeight: number): boolean {
  const PLAYER_RADIUS = 12;
  const HITBOX_BUFFER = 2; // Make hitbox slightly smaller for more forgiving gameplay
  const EFFECTIVE_RADIUS = PLAYER_RADIUS - HITBOX_BUFFER;
  const GROUND_HEIGHT = 50;
  const PLAYER_X = 512; // Player is always at x=512 in game coordinates (center of 1024px width)

  // Ground collision (use GAME_HEIGHT instead of windowHeight)
  if (player.y > GAME_HEIGHT - GROUND_HEIGHT - EFFECTIVE_RADIUS) {
    return true;
  }

  // Ceiling collision
  if (player.y < EFFECTIVE_RADIUS) {
    return true;
  }

  // Pipe collision - only check pipes player hasn't fully passed horizontally
  for (const pipe of pipes) {
    // Skip pipes that are completely behind the player
    if (pipe.x + PIPE_WIDTH < PLAYER_X - EFFECTIVE_RADIUS) {
      continue;
    }

    // Skip pipes that are ahead (not yet reached)
    if (pipe.x > PLAYER_X + EFFECTIVE_RADIUS) {
      continue;
    }

    // Player is currently inside pipe horizontally - check vertical collision
    // Check if circle center is in the gap (with radius margin)
    const clearTopPipe = player.y - EFFECTIVE_RADIUS > pipe.gapY;
    const clearBottomPipe = player.y + EFFECTIVE_RADIUS < pipe.gapY + PIPE_GAP;
    const inGap = clearTopPipe && clearBottomPipe;

    console.log(`Player Y: ${player.y} (${player.y - EFFECTIVE_RADIUS} to ${player.y + EFFECTIVE_RADIUS}), Pipe X: ${pipe.x}, Gap: ${pipe.gapY} to ${pipe.gapY + PIPE_GAP}, InGap: ${inGap}`);

    if (!inGap) {
      console.log(`COLLISION DETECTED!`);
      return true;
    }
  }

  return false;
}

function updateGame(room: GameRoom) {
  if (room.state !== "playing") return;

  const scaleFactor = 1; // Server uses fixed coordinates
  const playerX = GAME_WIDTH / 2;

  // Update all players
  for (const [playerId, player] of room.players) {
    if (!player.alive) continue;

    // Apply input
    if (player.jumping) {
      player.velocityY = JUMP_POWER;
    }

    // Apply physics
    player.velocityY += GRAVITY;
    player.y += player.velocityY;

    // Check collision
    if (checkCollision(player, room.pipes, room.windowHeight)) {
      player.alive = false;
      console.log(`Player ${playerId} died at y=${player.y}`);
    }

    // Check scoring
    for (const pipe of room.pipes) {
      if (
        pipe.x + PIPE_WIDTH < playerX * scaleFactor &&
        !pipe.scored.has(playerId) &&
        player.alive
      ) {
        pipe.scored.add(playerId);
        player.score++;
      }
    }
  }

  // Update pipes
  room.pipeCounter++;
  if (room.pipeCounter > 120) {
    const gapY = Math.random() * (GAME_HEIGHT - PIPE_GAP - 100) + 50;
    console.log(`Spawning pipe at x=${GAME_WIDTH}, gapY=${gapY}, GAME_WIDTH=${GAME_WIDTH}`);
    room.pipes.push({ x: GAME_WIDTH, gapY, scored: new Set() });
    room.pipeCounter = 0;
  }

  for (let i = room.pipes.length - 1; i >= 0; i--) {
    room.pipes[i].x -= PIPE_SPEED;
    if (room.pipes[i].x < -PIPE_WIDTH) {
      room.pipes.splice(i, 1);
    }
  }

  // Broadcast game state to all players
  broadcast(room, {
    type: "gameState",
    players: Array.from(room.players.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      y: p.y,
      score: p.score,
      alive: p.alive
    })),
    pipes: room.pipes.map(p => ({ x: p.x, gapY: p.gapY }))
  });

  // Check game over
  const alivePlayers = Array.from(room.players.values()).filter(p => p.alive);
  if (alivePlayers.length === 0) {
    stopGameLoop(room);
    room.state = "finished";

    const allPlayers = Array.from(room.players.values());
    const sortedPlayers = allPlayers.sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const topScore = winner?.score || 0;
    const gameDuration = room.gameStartTime
      ? Math.floor((Date.now() - room.gameStartTime) / 1000)
      : 0;

    broadcast(room, {
      type: "gameOver",
      winner: winner?.id || "",
      finalScores: sortedPlayers.map(p => ({
        id: p.id,
        score: p.score
      })),
      stats: {
        totalPlayers: allPlayers.length,
        gameDuration: gameDuration,
        topScore: topScore
      }
    });

    setTimeout(() => rooms.delete(room.id), 10000);
  }
}

function startGameLoop(room: GameRoom) {
  if (room.gameLoop) return;

  room.gameLoop = setInterval(() => {
    updateGame(room);
  }, 1000 / TICK_RATE);
}

function stopGameLoop(room: GameRoom) {
  if (room.gameLoop) {
    clearInterval(room.gameLoop);
    room.gameLoop = undefined;
  }
}

function handleConnection(req: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(req);

  let playerId: string | null = null;
  let roomId: string | null = null;

  socket.onopen = () => {
    playerId = crypto.randomUUID();
    console.log(`Player connected: ${playerId}`);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "join": {
          // Only join existing rooms - rooms must be created via Cloud Functions
          const requestedCode = data.roomCode?.toUpperCase();

          if (!requestedCode) {
            socket.send(JSON.stringify({
              type: "error",
              message: "Room code required"
            }));
            break;
          }

          // Try to find existing room with this code
          let room = Array.from(rooms.values()).find(r => r.code === requestedCode);

          if (!room) {
            // Room doesn't exist in memory - it should have been created via Cloud Functions
            // Create it in memory now (the Cloud Function already created it in Firestore)
            roomId = crypto.randomUUID();
            room = {
              id: roomId,
              code: requestedCode,
              players: new Map(),
              state: "waiting",
              pipes: [],
              pipeCounter: 0,
              windowHeight: data.windowHeight || 600
            };
            rooms.set(roomId, room);
            console.log(`Initialized room ${requestedCode} in memory (${roomId})`);
          } else {
            roomId = room.id;
            console.log(`Joined existing room ${requestedCode} (${roomId})`);
          }

          // Get existing players BEFORE adding the new one
          const existingPlayers = Array.from(room.players.entries())
            .map(([id, player]) => ({ id, name: player.name }));

          const player: Player = {
            id: playerId!,
            name: data.playerName || `Player${playerId!.substring(0, 6)}`,
            ws: socket,
            score: 0,
            alive: true,
            y: GAME_HEIGHT / 2,
            velocityY: 0,
            jumping: false
          };

          room.players.set(playerId!, player);

          // Send current room state to the joining player
          socket.send(JSON.stringify({
            type: "joined",
            playerId: playerId,
            roomId: roomId,
            roomCode: room.code,
            playerCount: room.players.size,
            existingPlayers: existingPlayers
          }));

          // Notify other players with player name
          const newPlayer = room.players.get(playerId!)!;
          broadcast(room, {
            type: "playerJoined",
            playerId: playerId,
            playerName: newPlayer.name,
            playerCount: room.players.size
          }, playerId!);

          break;
        }

        case "startGame": {
          if (!roomId) break;
          const room = rooms.get(roomId);
          if (!room) break;

          // Only allow starting if waiting and has players
          if (room.state === "waiting" && room.players.size >= 1) {
            room.state = "playing";
            room.gameStartTime = Date.now();
            broadcast(room, { type: "gameStart" });
            startGameLoop(room);
          }
          break;
        }

        case "input": {
          if (!roomId) break;
          const room = rooms.get(roomId);
          if (!room) break;

          const player = room.players.get(playerId!);
          if (!player) break;

          // Update input state
          player.jumping = data.jumping;
          break;
        }

        case "ping":
          socket.send(JSON.stringify({ type: "pong" }));
          break;
      }
    } catch (err) {
      console.error("Message error:", err);
    }
  };

  socket.onclose = () => {
    if (roomId && playerId) {
      const room = rooms.get(roomId);
      if (room) {
        room.players.delete(playerId);
        broadcast(room, {
          type: "playerLeft",
          playerId: playerId,
          playerCount: room.players.size
        });

        // Clean up empty rooms
        if (room.players.size === 0) {
          stopGameLoop(room);
          rooms.delete(roomId);
        }
      }
    }
    console.log(`Player disconnected: ${playerId}`);
  };

  return response;
}

Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);

  // Handle WebSocket connections - support both /ws and /ws/room/CODE
  if (url.pathname === "/ws" || url.pathname.startsWith("/ws/room/")) {
    return handleConnection(req);
  }

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      rooms: rooms.size,
      totalPlayers: Array.from(rooms.values()).reduce((sum, r) => sum + r.players.size, 0)
    }), {
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("Flappy Royale Server", { status: 200 });
});

console.log(`Flappy Royale server running on port ${PORT}`);
