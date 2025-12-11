# Cloud Functions Migration to Terraform

## Status
✅ Functions are now managed by Terraform
✅ All 5 lobby functions successfully imported

## Migration Complete!

The following functions are now managed by Terraform:
- `createRoom`
- `getRoom`
- `joinRoom`
- `leaveRoom`
- `updateRoomState`

## Future Deployments

### Update function code
1. Edit code in `lobby/createRoom/index.js`, `lobby/getRoom/index.js`, etc
2. Run `terraform apply` to deploy changes

```powershell
cd terraform
terraform apply
```

Terraform will:
- Zip the updated function code
- Upload to Cloud Storage
- Deploy the new version

## Function Structure

Each function has its own directory:
- `lobby/createRoom/` - index.js + package.json
- `lobby/getRoom/` - index.js + package.json
- `lobby/joinRoom/` - index.js + package.json
- `lobby/leaveRoom/` - index.js + package.json
- `lobby/updateRoomState/` - index.js + package.json

Terraform zips each directory (excluding node_modules) and uploads to GCS.
Cloud Build installs dependencies during deployment.

## What Changed

**Before:**
- Manual deployment via `lobby/deploy.sh`
- Functions in `lobby/functions/` (monorepo)
- No infrastructure-as-code

**After:**
- Terraform-managed functions
- Individual function directories
- Version-controlled infrastructure
- Automated deployments

## Deprecated Files

- `lobby/deploy.ps1` - Now exits with deprecation warning
- `lobby/functions/` - Old monorepo structure (can be removed after migration)
