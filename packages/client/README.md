# @photostore/client

React + Vite SPA for the [@photostore/api](../api) AWS Serverless API (Cognito, API Gateway, S3, DynamoDB).

## Stack

- **React 19** + **Vite** + TypeScript
- **TanStack Query** — API data fetching and mutations
- **AWS Amplify Auth** — Cognito sign-in; JWT sent to protected routes
- **Prettier** — code formatting

## Setup

From the **monorepo root**:

```bash
yarn install
cp packages/client/.env.example packages/client/.env   # if .env is missing
yarn dev
```

Or from this package:

```bash
yarn workspace @photostore/client dev
```

Configure `.env` from deploy outputs (see root README) or run from the repo root:

```bash
yarn env:sync
```

| Variable                   | Source                           |
| -------------------------- | -------------------------------- |
| `VITE_API_URL`             | `HttpApiUrl` (no trailing slash) |
| `VITE_USER_POOL_ID`        | `UserPoolId`                     |
| `VITE_USER_POOL_CLIENT_ID` | `UserPoolClientId`               |
| `VITE_IDENTITY_POOL_ID`    | `IdentityPoolId`                 |
| `VITE_AWS_REGION`          | e.g. `us-east-1`                 |

## Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `yarn dev`             | Start dev server (default http://localhost:5173) |
| `yarn build`           | Production build                                 |
| `yarn lint`            | ESLint                                           |
| `yarn format`          | Prettier write                                   |
| `yarn format:check`    | Prettier check                                   |

Run these via `yarn workspace @photostore/client <script>` from the repo root, or `yarn <script>` from `packages/client`.

## API flow

Authenticated routes match the backend README:

1. `POST /photos/upload-url` — presigned S3 PUT URL
2. `PUT` to S3 (direct, no JWT)
3. `POST /photos` — save metadata
4. `GET /photos` — list your photos

`GET /hello` is public and shown as an API health indicator when the app loads.
