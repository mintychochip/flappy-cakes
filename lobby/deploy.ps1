# DEPRECATED: Functions are now managed by Terraform
# Use: cd ../terraform && terraform apply
# This script is kept for reference only

Write-Host "⚠️  DEPRECATED: Functions are now managed by Terraform" -ForegroundColor Yellow
Write-Host "Run: cd ../terraform && terraform apply"
exit 1

PROJECT_ID="flappy-cakes"
REGION="us-central1"

echo "Deploying Cloud Functions..."

# Deploy createRoom
gcloud functions deploy createRoom \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=createRoom \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID

# Deploy getRoom
gcloud functions deploy getRoom \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=getRoom \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID

# Deploy joinRoom
gcloud functions deploy joinRoom \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=joinRoom \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID

# Deploy leaveRoom
gcloud functions deploy leaveRoom \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=leaveRoom \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID

# Deploy updateRoomState
gcloud functions deploy updateRoomState \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=updateRoomState \
  --trigger-http \
  --allow-unauthenticated \
  --project=$PROJECT_ID

echo "Done deploying functions!"
