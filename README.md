# Flappy Royale

Multiplayer Flappy Bird game with Deno WebSocket server running on AWS Fargate.

## Project Structure

```
flappy-royale/
├── server/              # Deno WebSocket server
│   ├── src/
│   ├── Dockerfile
│   └── deno.json
└── terraform/           # AWS infrastructure
    ├── modules/
    ├── scripts/
    └── main.tf
```

## Quick Start

### Local Development

```bash
# Run server locally
cd server
deno task dev

# Test health endpoint
curl http://localhost:8080/health

# Test WebSocket
npx wscat -c ws://localhost:8080
```

### AWS Deployment

See [terraform/README.md](terraform/README.md) for deployment instructions.

## Architecture

- **Server**: Deno WebSocket server (port 8080)
- **Infrastructure**: AWS Fargate with ALB
- **Auto-scaling**: 2-10 containers based on CPU/memory
- **Monitoring**: CloudWatch logs and alarms
- **Networking**: Multi-AZ VPC with public/private subnets

## Tech Stack

- **Runtime**: Deno
- **Infrastructure**: Terraform + AWS (ECS Fargate, ALB, ECR)
- **Containerization**: Docker
- **Monitoring**: CloudWatch

## Development

Server code is in `server/src/`:
- `main.ts` - WebSocket server entrypoint
- `utils/health.ts` - Health check endpoint
- `utils/logger.ts` - Structured logging

Game logic will go in `server/src/game/` (TODO).

## Deployment Flow

1. **Setup**: Create S3/DynamoDB for Terraform state
2. **Infrastructure**: Deploy VPC, ALB, ECS cluster
3. **Build**: Create Docker image, push to ECR
4. **Deploy**: ECS pulls image and runs containers
5. **Monitor**: CloudWatch logs/metrics, auto-scaling

## Configuration

Edit `terraform/terraform.tfvars`:
- Container resources (CPU/memory)
- Auto-scaling limits (min/max tasks)
- Scaling triggers (CPU/memory thresholds)
- Email alerts (optional)

## License

MIT
