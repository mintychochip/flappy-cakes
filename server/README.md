# Flappy Royale Server

Minimal Deno WebSocket server for Flappy Bird battle royale.

## Features

- WebSocket-based real-time multiplayer (up to 100 players per room)
- Auto-matchmaking
- Health endpoint for load balancer
- Horizontal pod autoscaling

## Local Development

```bash
deno task dev
```

## Docker Build

```bash
docker build -t flappy-royale-server .
```

## GCP Deployment with Terraform

### Prerequisites

- GCP account with billing enabled
- `gcloud` CLI installed and authenticated
- `terraform` installed
- Docker installed

### Setup

1. Authenticate with GCP:
```bash
gcloud auth login
gcloud auth application-default login
```

2. Enable required APIs:
```bash
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable compute.googleapis.com
```

3. Configure Terraform variables:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id and settings
```

### Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

This creates:
- GKE cluster with autoscaling node pool
- VPC network and subnet
- Artifact Registry repository
- Kubernetes deployment with HPA
- Load balancer service

### Build and Push Image

```bash
# Get artifact registry URL from terraform output
REPO_URL=$(terraform output -raw artifact_registry_url)

# Configure Docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push
cd ..
docker build -t $REPO_URL/flappy-royale-server:latest .
docker push $REPO_URL/flappy-royale-server:latest
```

### Update Deployment

After pushing new image:
```bash
cd terraform
terraform apply -replace=kubernetes_deployment.flappy_server
```

Or use kubectl:
```bash
gcloud container clusters get-credentials flappy-royale-cluster --region us-central1
kubectl rollout restart deployment/flappy-royale-server
```

### Get Load Balancer IP

```bash
cd terraform
terraform output load_balancer_ip
```

### Destroy

```bash
cd terraform
terraform destroy
```

## API

### WebSocket `/ws`

Client messages:
- `{type: "join"}` - Join/create room
- `{type: "update", position: {x, y}, score: number, alive: boolean}` - Update player state
- `{type: "ping"}` - Ping server

Server messages:
- `{type: "joined", playerId, roomId, playerCount}`
- `{type: "gameStart"}`
- `{type: "playerUpdate", playerId, position, score, alive}`
- `{type: "gameOver", winner, finalScores}`
- `{type: "pong"}`

### HTTP `/health`

Returns server health and stats.
