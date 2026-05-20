# Environment configuration (deploy & remove)

## Two different “env” layers

| Layer | Where it lives | Survives `deploy`? | Survives `remove`? |
|-------|----------------|--------------------|--------------------|
| **Backend (Lambda)** | `serverless.yml` → `provider.environment` | Yes (updated in place) | No — stack deleted |
| **Frontend (Vite)** | `photostoreclient/.env` | Yes (local file) | Yes (file remains, values stale) |

The backend does **not** read a `.env` file at runtime. CloudFormation sets Lambda variables (`PHOTOS_TABLE`, `PHOTOS_BUCKET`, etc.) from resources in the same stack.

The client needs **deploy outputs** (`HttpApiUrl`, `UserPoolId`, `IdentityPoolId`, …) in `VITE_*` variables.

## After deploy — sync client `.env`

```bash
cd photostore
npx serverless deploy          # or: npm run deploy
npm run env:sync               # writes ../photostoreclient/.env
# one step:
npm run deploy:sync
```

This also saves a snapshot: `.deploy/outputs-dev.json` (gitignored).

Requires: AWS CLI, `jq`, and credentials for the account/region.

## Before remove — backup client `.env`

`serverless remove` deletes Cognito, API Gateway, S3 bucket, DynamoDB table, etc. Your local `.env` still points at deleted resources.

```bash
npm run env:backup             # → .deploy/env-backups/client-env-<timestamp>.env
npm run remove:safe            # backup + remove
```

After a **fresh** deploy, run `npm run env:sync` again and restart the Vite dev server.

## What you cannot retain across `remove`

- Cognito user pool / identity pool ids (new ids on redeploy)
- API URL
- S3 keys and DynamoDB data (unless you add `DeletionPolicy: Retain` on resources)

User accounts in Cognito are gone when the pool is deleted; users must sign up again.

## Optional: backend secrets in `.env`

If you later add secrets (API keys, etc.), use `serverless-dotenv-plugin` or SSM Parameter Store. Keep `.env` gitignored; commit `.env.example` only.
