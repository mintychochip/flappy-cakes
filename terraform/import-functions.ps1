$PROJECT_ID = "flappy-cakes"
$REGION = "us-central1"

Write-Host "Importing Cloud Functions into Terraform state..."
Write-Host ""

$functions = @("createRoom", "getRoom", "joinRoom", "leaveRoom", "updateRoomState")

foreach ($func in $functions) {
  Write-Host "Importing $func..."
  $resourceAddr = "google_cloudfunctions2_function.lobby_functions[\`"$func\`"]"
  $resourceId = "projects/$PROJECT_ID/locations/$REGION/functions/$func"
  terraform import $resourceAddr $resourceId
  Write-Host ""
}

Write-Host "Import complete! Run 'terraform plan' to verify."
