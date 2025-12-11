# Flappy Royale Architecture

## Overview
Flappy Royale is a multiplayer battle royale game where players compete simultaneously in Flappy Bird-style gameplay.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React + Vite)                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Browser   │  │    Mobile    │  │  Controller   │ │
│  │   (Host)    │  │   (Player)   │  │  (Phone)      │ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼─────────────────┼──────────────────┼─────────┘
          │                 │                  │
          │ WebSocket       │ WebSocket        │ WebSocket
          │                 │                  │
┌─────────▼─────────────────▼──────────────────▼─────────┐
│              GAME SERVER (WebSocket)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Game Loop (60 FPS)                              │  │
│  │  - Physics simulation                            │  │
│  │  - Collision detection                           │  │
│  │  - State broadcasting                            │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────┐
│              LOBBY SYSTEM (Cloud Functions)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  createRoom  │  │   joinRoom   │  │  leaveRoom   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │   getRoom    │  │ updateState  │                   │
│  └──────────────┘  └──────────────┘                   │
└──────────────────────────────────────┬──────────────────┘
                                       │
                                       │ Firestore API
                                       │
┌──────────────────────────────────────▼──────────────────┐
│                    FIRESTORE DATABASE                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  rooms/                                          │  │
│  │  ├─ {roomCode}/                                  │  │
│  │  │  ├─ code: string                              │  │
│  │  │  ├─ hostId: string                            │  │
│  │  │  ├─ players: array                            │  │
│  │  │  ├─ state: "waiting" | "playing" | "finished" │  │
│  │  │  └─ createdAt: timestamp                      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend (Client)
- **React** - UI framework
- **TypeScript** - Type safety
- **PixiJS** - WebGL rendering engine
- **Vite** - Build tool & dev server
- **React Router** - Client-side routing
- **TailwindCSS** - Styling

### Backend
- **WebSocket Server** - Real-time game server (Node.js)
  - Hosted on GKE (Google Kubernetes Engine)
  - Load balancer IP: `136.116.63.90`

- **Cloud Functions** - Lobby management
  - `createRoom` - Generate room codes
  - `getRoom` - Fetch room details
  - `joinRoom` - Add player to room
  - `leaveRoom` - Remove player from room
  - `updateRoomState` - Update game state

### Infrastructure
- **Google Cloud Platform**
  - GKE cluster for game server
  - Cloud Functions for lobby API
  - Firestore for room state
  - Artifact Registry for Docker images
  - Cloud Storage for function code

- **Terraform** - Infrastructure as Code
  - All resources managed via Terraform
  - Located in `/terraform` directory

## Data Flow

### 1. Room Creation
```
Player → createRoom() → Firestore → roomCode
                 ↓
        Player navigates to /lobby/{roomCode}
```

### 2. Joining Game
```
Player → joinRoom(code) → Firestore updates room
                 ↓
        Player connects to WebSocket server
                 ↓
        Server assigns playerId
```

### 3. Game Loop (60 FPS)
```
Player Input → WebSocket → Server
                            ↓
                    Physics Simulation
                            ↓
                    Collision Detection
                            ↓
                    Game State Update
                            ↓
              Broadcast to all players
                            ↓
Client renders new state (PixiJS)
```

### 4. Game Over
```
Server detects all players dead
        ↓
Calculates final scores
        ↓
Sends GameOverMessage
        ↓
Client navigates to /game-over
        ↓
Display analytics & leaderboard
        ↓
Auto-redirect to home (15s)
```

## Message Types

All WebSocket messages follow typed interfaces (see `/client/src/types/game.ts`):

### Server → Client
- `JoinedMessage` - Player joined successfully
- `GameStartMessage` - Game has started
- `GameStateMessage` - Current game state (60/sec)
- `PlayerJoinedMessage` - Another player joined
- `PlayerLeftMessage` - Player disconnected
- `GameOverMessage` - Game ended with results

### Client → Server
- `join` - Connect to game
- `input` - Send player input (jumping)
- `ping` - Heartbeat

## Routes

- `/` - Home page (create/join room)
- `/lobby/:roomCode` - Pre-game lobby
- `/host/:roomCode` - Host view (main screen)
- `/controller/:roomCode` - Mobile controller
- `/game-over` - Post-game analytics

## Key Components

### GameClient (`game-client.ts`)
- WebSocket connection manager
- Event emitter for game events
- Reconnection logic (exponential backoff)
- Analytics tracking (game duration, pipes passed)

### GameRenderer (`renderer.ts`)
- PixiJS-based rendering
- Draws player, pipes, background
- Runs at 60 FPS

### GameContext (`contexts/GameContext.tsx`)
- React context for shared game state
- Single GameClient instance across routes

## Testing

Run tests:
```bash
cd client
npm test              # Run all tests
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
```

Test files:
- `game-client.test.ts` - GameClient unit tests
- `game.test.ts` - Type validation tests

## Deployment

### Client
```bash
cd client
npm run build
# Deploy dist/ to hosting (Firebase, GCS, etc)
```

### Server
```bash
cd terraform
terraform apply
# Builds & deploys to GKE
```

### Functions
```bash
cd terraform
terraform apply
# Updates Cloud Functions
```

## Known Limitations

1. **API Gateway not in Terraform**
   - Manually managed via gcloud
   - TODO: Migrate to google-beta provider

2. **No Horizontal Scaling**
   - WebSocket server is single instance
   - Room state not shared across instances

3. **No Authentication**
   - All Cloud Functions allow `allUsers`
   - No player accounts or profiles

4. **Limited Analytics**
   - Basic game stats only
   - No historical tracking
   - No leaderboards

5. **No Error Tracking**
   - Errors logged to console only
   - TODO: Add Sentry or Cloud Logging

## Future Improvements

- [ ] Add player authentication
- [ ] Implement global leaderboards
- [ ] Add spectator mode
- [ ] Store match history
- [ ] Add CI/CD pipeline
- [ ] Implement blue/green deployments
- [ ] Add rate limiting
- [ ] Improve error handling
- [ ] Add monitoring & alerts
- [ ] Optimize WebSocket server for scaling

## Development

```bash
# Start client dev server
cd client
npm run dev

# Start server (in separate terminal)
cd server
npm run dev

# Run tests
cd client
npm test
```

## License

MIT
