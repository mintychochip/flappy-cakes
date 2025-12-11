# Flappy Royale - Lobby Service (Cloud Functions)

Serverless lobby management using GCP Cloud Functions + API Gateway + Firestore.

## Architecture

- **Cloud Functions (Gen 2)**: Individual Lambda-style functions
- **API Gateway**: Routes HTTP requests to functions
- **Firestore**: Persistent room storage

## Functions

1. `createRoom` - POST /api/rooms
2. `getRoom` - GET /api/rooms/get?code=XXXX
3. `joinRoom` - POST /api/rooms/join
4. `leaveRoom` - POST /api/rooms/leave
5. `updateRoomState` - PUT /api/rooms/state

## Deployment

### 1. Install dependencies
```bash
cd lobby
npm install
```

### 2. Deploy functions
```bash
chmod +x deploy.sh
./deploy.sh
```

### 3. Deploy API Gateway
```bash
# Create API config
gcloud api-gateway api-configs create lobby-config \
  --api=lobby-api \
  --openapi-spec=api-gateway.yaml \
  --project=flappy-cakes \
  --backend-auth-service-account=PROJECT_NUMBER-compute@developer.gserviceaccount.com

# Create gateway
gcloud api-gateway gateways create lobby-gateway \
  --api=lobby-api \
  --api-config=lobby-config \
  --location=us-central1 \
  --project=flappy-cakes
```

### 4. Enable Firestore
```bash
gcloud firestore databases create --location=us-central --project=flappy-cakes
```

## API Endpoints (via Gateway)

After deployment, API Gateway provides a single endpoint:
```
https://lobby-gateway-XXXXX.uc.gateway.dev
```

### Create Room
```
POST /api/rooms
Response: { code, hostId, players, state, createdAt }
```

### Get Room
```
GET /api/rooms/get?code=ABCD
Response: { code, hostId, players, state, createdAt }
```

### Join Room
```
POST /api/rooms/join
Body: { code, playerId? }
Response: { playerId, room }
```

### Leave Room
```
POST /api/rooms/leave
Body: { code, playerId }
Response: { success: true }
```

### Update State
```
PUT /api/rooms/state
Body: { code, state: "waiting"|"playing"|"finished" }
Response: { code, hostId, players, state, createdAt }
```

## Local Testing

```bash
npm install -g @google-cloud/functions-framework
functions-framework --target=createRoom --source=functions
```
