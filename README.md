# photostore-learn

AWS Serverless learning project: **Lambda**, **API Gateway (HTTP API)**, **DynamoDB**, **S3**, and **Amazon Cognito**—step by step. **Cognito / auth (steps 6–8)** are not implemented yet.

## Prerequisites

- Node.js and npm
- AWS CLI configured (`aws sts get-caller-identity` works)
- IAM permissions to deploy (CloudFormation, Lambda, API Gateway, etc.)

## Commands (use project-local Serverless v3)

Global `serverless` may be **v4**, which requires a Serverless.com login. This repo pins **Serverless Framework v3** so you can work without that:

```bash
npm install
npm run print          # validate serverless.yml
npx serverless deploy
npx serverless invoke -f hello --log
npx serverless remove   # delete stack / avoid stray resources on shared accounts
```

After deploy, call **`GET /hello`** using the HTTP API base URL from the deploy output:

```bash
curl "https://<api-id>.execute-api.us-east-1.amazonaws.com/hello"
```

## Current stack

- **Service:** `photostore-learn` (see `serverless.yml`)
- **Stage:** `dev` (default)
- **Lambdas:** `hello`, `createPhoto`, `listPhotos`, `uploadPhotoUrl` (TypeScript in `src/`, bundled with esbuild)
- **API (HTTP API, CORS enabled):**

  | Method | Path                   | Handler              |
  | ------ | ---------------------- | -------------------- |
  | `GET`  | `/hello`               | health / event echo  |
  | `POST` | `/photos/upload-url`   | presigned S3 PUT URL |
  | `POST` | `/photos`              | save metadata        |
  | `GET`  | `/photos`              | list metadata        |

- **DynamoDB:** `photostore-learn-dev-photos` (`photoId` partition key) — [DynamoDB wiring](#dynamodb-wiring-in-serverlessyml)
- **S3:** private photos bucket (SSE-S3, block public access, bucket CORS for browser PUT) — [S3 wiring](#s3-wiring-in-serverlessyml)

### Photo upload flow (step 5)

Use the HTTP API base URL from deploy output as `API`:

```bash
# 1. Get presigned upload URL + photoId + s3Key
curl -s -X POST "$API/photos/upload-url" \
  -H "content-type: application/json" \
  -d '{"contentType":"image/jpeg"}' | tee /tmp/upload.json

# 2. PUT image bytes directly to S3 (not through API Gateway)
UPLOAD_URL=$(jq -r .uploadUrl /tmp/upload.json)
curl -X PUT -H "Content-Type: image/jpeg" --data-binary @photo.jpg "$UPLOAD_URL"

# 3. Save metadata in DynamoDB (use photoId + s3Key from step 1)
PHOTO_ID=$(jq -r .photoId /tmp/upload.json)
S3_KEY=$(jq -r .s3Key /tmp/upload.json)
curl -s -X POST "$API/photos" \
  -H "content-type: application/json" \
  -d "{\"photoId\":\"$PHOTO_ID\",\"s3Key\":\"$S3_KEY\",\"caption\":\"beach sunset\"}"

# 4. List metadata
curl -s "$API/photos"
```

#### Handlers and routes (same upload flow)

One user journey, **three HTTP steps**, **two API Lambdas** in `src/photos.ts`. Step 2 has no Lambda—the client talks to S3 directly.

| Step | Route | `serverless.yml` function | Handler (`src/photos.ts`) | What it does |
| ---- | ----- | ------------------------- | ------------------------- | ------------ |
| **1** | `POST /photos/upload-url` | `uploadPhotoUrl` | `uploadUrl` | Presign S3 `PUT`; return `photoId`, `s3Key`, `uploadUrl` |
| **2** | `PUT` presigned URL | — | — | Client uploads file bytes to **S3** (not API Gateway) |
| **3** | `POST /photos` | `createPhoto` | **`create`** | Validate body; **PutItem** metadata to DynamoDB |
| *(list)* | `GET /photos` | `listPhotos` | `list` | **Scan** metadata (separate from upload; no S3) |

```text
uploadUrl  →  (client PUT S3)  →  create
   ↑                                  ↑
   POST /photos/upload-url            POST /photos
```

- **`uploadUrl`** — S3 presigning only; does not write DynamoDB or receive file bytes.
- **`create`** — DynamoDB only; assumes the object already exists at `s3Key`. Skipping step 3 leaves an orphan file in S3 with no row in `GET /photos`.

### React / Amplify client flow {#react-amplify-client-flow}

A browser app (including **Amplify Hosting + React**) uses the same three HTTP steps as `curl`. Only **two** requests hit your API; the file goes **directly to S3**.

Set the API base URL in the frontend (e.g. Vite `VITE_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com`).

#### Sequence (one photo upload)

```mermaid
sequenceDiagram
  participant User
  participant React as React app
  participant API as HTTP API + Lambda
  participant S3 as S3 bucket
  participant DDB as DynamoDB

  User->>React: Pick file + caption, Submit
  React->>API: POST /photos/upload-url<br/>{ contentType }
  API->>API: getSignedUrl(PutObject)
  API-->>React: { photoId, s3Key, uploadUrl }

  React->>S3: PUT uploadUrl<br/>body = file bytes<br/>Content-Type matches
  S3-->>React: 200 OK

  React->>API: POST /photos<br/>{ photoId, s3Key, caption }
  API->>DDB: PutItem
  DDB-->>API: OK
  API-->>React: 201 { photo }
  React-->>User: Success

  Note over React,API: Later (step 7): add Authorization Bearer on both POSTs
  Note over React,S3: S3 PUT uses presigned URL host, not API Gateway
```

#### Request checklist

| Step | From | Method | URL | Body |
| ---- | ---- | ------ | --- | ---- |
| 1 | React → **your API** | `POST` | `{API}/photos/upload-url` | `{ "contentType": "image/jpeg" }` |
| 2 | React → **S3** | `PUT` | `uploadUrl` from step 1 | Raw `File` / `Blob` (same `Content-Type`) |
| 3 | React → **your API** | `POST` | `{API}/photos` | `{ "photoId", "s3Key", "caption" }` from step 1 + form |

Optional: `GET {API}/photos` to list metadata (no image bytes; viewing needs presigned GET later).

#### Flowchart (who talks to whom)

```mermaid
flowchart LR
  subgraph client [Browser / React]
    UI[PhotoUpload form]
  end

  subgraph api [Your stack]
    GW[HTTP API]
    L1[uploadPhotoUrl Lambda]
    L2[createPhoto Lambda]
    DB[(DynamoDB)]
  end

  S3[(S3 bucket)]

  UI -->|1 POST upload-url| GW --> L1
  L1 -->|presigned URL| UI
  UI -->|2 PUT file bytes| S3
  UI -->|3 POST metadata| GW --> L2 --> DB
```

#### Minimal React helper (copy-paste)

```ts
const API = import.meta.env.VITE_API_URL; // no trailing slash

export async function uploadPhoto(file: File, caption: string) {
  // Map file MIME type → allowed contentType for presigning
  const contentType =
    file.type === "image/png"
      ? "image/png"
      : file.type === "image/webp"
        ? "image/webp"
        : "image/jpeg";

  // Step 1: POST to your API → Lambda uploadUrl → presigned PUT URL + photoId + s3Key
  const signRes = await fetch(`${API}/photos/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });
  if (!signRes.ok) throw new Error(await signRes.text());
  const { photoId, s3Key, uploadUrl } = await signRes.json();

  // Step 2: PUT file bytes directly to S3 (not API Gateway); Content-Type must match step 1
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error(await putRes.text());

  // Step 3: POST to your API → Lambda create → DynamoDB PutItem (metadata catalog)
  const metaRes = await fetch(`${API}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoId, s3Key, caption }),
  });
  if (!metaRes.ok) throw new Error(await metaRes.text());
}
```

**Amplify notes:** You do **not** need Amplify **Storage** for this lesson—the app calls your custom API with `fetch`. Host the SPA on Amplify Hosting; put `VITE_API_URL` in branch env vars. After Cognito (steps 6–7), add `Authorization: Bearer <idToken>` on both API `POST`s in step 1 and 3 only.

Allowed `contentType` values: `image/jpeg`, `image/png`, `image/webp` (default `image/jpeg`). Presigned URLs expire after **5 minutes** (`UPLOAD_URL_EXPIRES_SECONDS` in `src/s3.ts`).

**How presigning works:** [S3 presigned URLs](#s3-presigned-urls-how-upload-signing-works) (recommended read after your first successful upload).

**Next lesson step:** **6. Cognito User Pool** in the [learning path](#learning-path-recommended-order) — identity and JWTs before protecting routes.

---

## Learning path (recommended order)

Each step adds **one main idea**. Redeploy and verify before moving on.

### 1. Deploy loop & stack mental model

`deploy` → inspect Lambda / CloudFormation → `invoke` or `curl` → `remove`.

**Why first:** later steps are “edit config or code, redeploy, verify.”

### 2. API Gateway ↔ Lambda contract

Extend `hello`: log or return parts of the **HTTP API event** (path, method, query string).

**Why next:** understand what “serverless HTTP” is before TypeScript and databases.

### 3. TypeScript + bundling

Move the handler to TypeScript; add **esbuild** (or similar) via a Serverless plugin; deploy again.

**Why here:** adopt real project tooling while the function is still small.

### 4. DynamoDB (metadata only)

Define a table in `serverless.yml` (`resources`), IAM scoped to that table, env var for table name, **`POST`** to write and **`GET`** to read (a `Scan` is fine at first).

**Why before S3:** learn one data service and IAM boundary without file uploads.

### 5. S3 (binary) + connect to Dynamo ✅

Private bucket, **`POST /photos/upload-url`** (presigned PUT), then **`POST /photos`** with **`photoId` + `s3Key` + caption**. See [Photo upload flow](#photo-upload-flow-step-5), [React / Amplify client flow](#react-amplify-client-flow), [S3 presigned URLs](#s3-presigned-urls-how-upload-signing-works), and [S3 wiring](#s3-wiring-in-serverlessyml).

**Why after Dynamo:** rows are the index; S3 is where the bytes live.

### 6. Cognito User Pool (identity) ← next

Create a user pool + app client; obtain tokens (console or small test flow).

**Why after the API does something real:** you know which routes to protect.

### 7. JWT authorizer on the HTTP API

Attach API Gateway **JWT authorizer** (Cognito) to sensitive routes (e.g. `POST` / `GET` photos); keep e.g. **`GET /hello`** public if you want a health check.

**Why here:** see **401** vs **200** with and without `Authorization: Bearer <token>`.

### 8. Use identity in data (`sub`)

On writes, set **`ownerId`** from the JWT **`sub`**; change reads to “**my** photos” (`Query` / GSI) instead of a global `Scan`.

**Why last among core features:** needs both **auth** and a **data model**.

### 9. Optional stretch goals

- **Cognito Identity Pool** + scoped **browser → S3** access
- Presigned **GET** or **CloudFront** for viewing images
- Better errors, least-privilege IAM, Cognito MFA / password policies

---

## Cognito in one line

- **User Pool:** who the user is (accounts + **JWTs**).
- **Identity Pool (optional, later):** temporary **AWS credentials** for that user (often for direct S3 from the browser).

## Hygiene on shared accounts

Use **`npx serverless remove`** when an experiment is done so you do not leave Lambdas, APIs, and roles running in a shared or non-production AWS account (unless that account is a long-lived sandbox).

---

## Stack reference

Deeper notes on **AWS** and how this repo’s stack fits together. Tied to `serverless.yml` and `src/` as they exist today, plus what the [learning path](#learning-path-recommended-order) adds later.

| Topic                               | Section                                    |
| ----------------------------------- | ------------------------------------------ |
| AWS account & billing               | [Below](#aws-account--billing)             |
| IAM & deploy permissions            | [Below](#iam--deploy-permissions)          |
| Serverless Framework                | [Below](#serverless-framework)             |
| Deploy, CloudFormation & cleanup    | [Below](#deploy-cloudformation--cleanup)   |
| API Gateway & HTTP                  | [Below](#api-gateway--http)                |
| DynamoDB wiring in `serverless.yml` | [Below](#dynamodb-wiring-in-serverlessyml) |
| S3 wiring in `serverless.yml`     | [Below](#s3-wiring-in-serverlessyml)       |
| S3 presigned URLs (upload signing) | [Below](#s3-presigned-urls-how-upload-signing-works) |
| React / Amplify client upload flow | [Below](#react-amplify-client-flow)        |
| CloudWatch (debugging endpoints)    | [Below](#cloudwatch-debugging-endpoints)   |
| CORS                                | [Below](#cors)                             |
| S3, DynamoDB & CloudFront           | [Below](#s3-dynamodb--cloudfront)          |

### AWS account & billing

**How AWS charges**

- There is no flat “AWS subscription.” You pay per service, per region, per usage (requests, storage, duration).
- A **payment method** is required on the account even when you stay inside free tier.

**Free tier (examples relevant to this project)**

| Service     | Typical free-tier idea (check current AWS docs for exact caps) |
| ----------- | -------------------------------------------------------------- |
| Lambda      | Monthly free requests + compute time                           |
| API Gateway | HTTP API request count cap                                     |
| DynamoDB    | On-demand / provisioned capacity within free allowance         |
| S3          | Storage + requests within small monthly limits                 |
| CloudFront  | Often limited free data transfer for 12 months                 |

Caps change; always confirm in the [AWS Free Tier](https://aws.amazon.com/free/) page. Leaving a stack deployed 24/7 can still incur cost once you exceed caps.

**Cost control habits**

- Deploy to **one region** (`us-east-1` in this repo) while learning.
- Run **`npx serverless remove`** when you finish a session so Lambda, API Gateway, and IAM roles from this service are torn down.
- Set a **billing budget + email alert** in the AWS console (Billing → Budgets).

### IAM & deploy permissions

**Who should call AWS**

| Identity             | Use for                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| **Root user**        | Account recovery, billing, enabling MFA—avoid daily deploys                         |
| **IAM user / role**  | CLI (`aws configure`), Serverless deploys, console work                             |
| **Lambda exec role** | What the **function** may do at runtime (e.g. read a DynamoDB table)—not your login |

**What `serverless deploy` needs (your IAM user/role)**

Serverless drives **CloudFormation**. Your deploy principal must be allowed to create/update at least:

- `cloudformation:*` (stack create/update/delete for this app)
- `lambda:*` (function code and configuration)
- `apigateway:*` or HTTP API–scoped actions (routes, integrations)
- `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PassRole` (Lambda **execution** role)
- Later steps: `dynamodb:*` (table), `s3:*` (bucket), `cognito-idp:*` (user pool)

**`PowerUserAccess` vs `AdministratorAccess`**

- **`PowerUserAccess`:** can use most services but **cannot** manage IAM fully. Often **blocks** Serverless when it must create the Lambda execution role.
- **`AdministratorAccess`:** broad; fine for a personal sandbox, too wide for production.
- **Better for teams:** dedicated **sandbox account** or a **custom policy** listing only the actions above for one region.

**Lambda execution role (runtime)**

Separate from your login. When you add DynamoDB/S3 in `serverless.yml`, you grant **only that role** `dynamodb:PutItem` on **one table ARN**, not admin on the whole account. That is **least privilege** at runtime.

### Serverless Framework

**This repo**

- `frameworkVersion: "3"` and `serverless` in `devDependencies` → use **`npx serverless deploy`**, not bare `serverless` from PATH.
- **`npm run print`** expands `serverless.yml` to the final CloudFormation-oriented config (good sanity check before deploy).

**v3 vs global v4**

|                         | Project-local v3 (`npx serverless`) | Global v4 (`serverless` on PATH) |
| ----------------------- | ----------------------------------- | -------------------------------- |
| Login to Serverless.com | Not required for `print` / deploy   | Often required                   |
| Config in this repo     | `frameworkVersion: "3"`             | Ignored if you run global CLI    |

**Key files**

| File             | Role                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `serverless.yml` | Service name, region, functions, events, `resources` (DynamoDB, S3) |
| `src/`           | TypeScript handlers (`handler.ts`, `photos.ts`, …)                 |
| `.serverless/`   | Generated artifacts after deploy (gitignored)                      |

### Deploy, CloudFormation & cleanup

**What happens on `npx serverless deploy`**

1. Serverless bundles `src/` with esbuild (see `serverless-esbuild` plugin).
2. Uploads the zip to an S3 bucket AWS uses for deployments (managed by the framework).
3. Creates or updates a **CloudFormation stack** named like `photostore-learn-dev`.
4. CloudFormation creates/updates resources defined by the framework: **Lambda**, **IAM role**, **CloudWatch log groups**, **HTTP API**, **DynamoDB table**, **S3 bucket**, and route → Lambda integrations.

**Lambda name rule**

```
{service}-{stage}-{functionKey}
photostore-learn + dev + hello → photostore-learn-dev-hello
```

Defined in config by `service: photostore-learn`, default `stage: dev`, and `functions.hello`—not a string in application code.

**Deploy output**

A line like `hello: photostore-learn-dev-hello (156 kB)` means: function key `hello`, AWS name `photostore-learn-dev-hello`, zip size `156 kB`. You should also see an **HTTP API endpoint** URL for `GET /hello`.

**`npx serverless remove`**

- Deletes the **CloudFormation stack** and resources it owns (this service’s Lambda, API, role, etc.).
- Does **not** delete your laptop repo or uncommitted edits.
- Does **not** remove resources you created manually in the console outside this stack.
- After remove, `deploy` again creates a **new** stack; the API hostname may change.

**`deploy` vs local code**

| Location | `remove` effect              | `deploy` effect                                    |
| -------- | ---------------------------- | -------------------------------------------------- |
| AWS      | Stack gone until next deploy | Publishes current `src/` / `serverless.yml`        |
| Your Mac | No change to files           | No change to files until you edit and deploy again |

### API Gateway & HTTP

**What this project uses**

- **HTTP API** (API Gateway v2)—lower cost and simpler than the older **REST API** for Lambda proxy use cases.
- Config in `serverless.yml`:

```yaml
provider:
  httpApi:
    cors: true
functions:
  hello:
    handler: src/handler.hello
    events:
      - httpApi:
          path: /hello
          method: GET
```

Routes are declared per function under `events`. This repo also wires **`POST /photos/upload-url`**, **`POST /photos`**, and **`GET /photos`** (see [Current stack](#current-stack)).

**End-to-end request flow**

```text
Client (curl, browser, app)
  → HTTPS GET https://<api-id>.execute-api.us-east-1.amazonaws.com/hello
  → API Gateway HTTP API (TLS termination, route match)
  → Lambda Invoke (photostore-learn-dev-hello)
  → src/handler.hello(event) runs in Node 20
  → returns { statusCode, headers, body }
  → API Gateway maps that to HTTP response
  → Client receives JSON
```

**Handler contract (proxy integration)**

Lambda does not write to the socket directly. It must return:

```js
{
  statusCode: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ... }),  // string, not a raw object
}
```

`src/handler.ts` also echoes parts of `event` so you can see what API Gateway passed in.

**HTTP API event (payload format 2.0)—fields used in this repo**

| Field                          | Example / meaning             |
| ------------------------------ | ----------------------------- |
| `routeKey`                     | `"GET /hello"`                |
| `rawPath`                      | `"/hello"`                    |
| `rawQueryString`               | `"foo=bar"` or `""`           |
| `queryStringParameters`        | `{ "foo": "bar" }` or `null`  |
| `requestContext.http.method`   | `"GET"`                       |
| `requestContext.http.sourceIp` | Client IP seen by API Gateway |

Other common fields: `headers`, `body`, `pathParameters`, `cookies`, `requestContext.accountId`, `requestContext.apiId`. Full spec: [HTTP API Lambda proxy](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html).

**Invoke URL**

- Shape: `https://<api-id>.execute-api.<region>.amazonaws.com/<path>`
- `<api-id>` is assigned by AWS (e.g. `hmffn49117`); it is not in source code.
- Find it: deploy output, `npx serverless info`, or **API Gateway → APIs → Routes → Invoke URL**.
- Example: `curl "https://<api-id>.execute-api.us-east-1.amazonaws.com/hello?foo=bar"`

**HTTP API vs REST API (why it matters)**

| HTTP API (this repo)         | REST API (older)                  |
| ---------------------------- | --------------------------------- |
| Cheaper for many use cases   | More features (API keys, caching) |
| Payload v2.0 `event`         | Different v1.0 `event` shape      |
| Simpler config in Serverless | More verbose integrations         |

### DynamoDB wiring in `serverless.yml`

This block connects Lambdas to **PhotosTable** (defined under `resources` in the same file). It does two jobs: tell functions **which table name to use**, and tell AWS **which DynamoDB actions the Lambda execution role may perform**.

```yaml
environment:
  PHOTOS_TABLE: !Ref PhotosTable
iam:
  role:
    statements:
      - Effect: Allow
        Action:
          - dynamodb:PutItem
          - dynamodb:GetItem
          - dynamodb:Scan
        Resource: !GetAtt PhotosTable.Arn
```

**`environment` — table name at runtime**

| Piece              | Meaning                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PHOTOS_TABLE`     | Environment variable injected into **every** function in this service (`hello`, `createPhoto`, `listPhotos`).                            |
| `!Ref PhotosTable` | CloudFormation intrinsic: resolves to the **table name** string (e.g. `photostore-learn-dev-photos` from `TableName` under `resources`). |

In code, `src/dynamo.ts` reads it:

```ts
process.env.PHOTOS_TABLE; // → "photostore-learn-dev-photos"
```

`createPhoto` and `listPhotos` pass that name to `PutCommand` / `ScanCommand`. Hard-coding the table name in TypeScript would break when stage or service name changes; `!Ref` keeps the name in one place in `serverless.yml`.

**`iam.role.statements` — what Lambda is allowed to do**

This is **not** your personal IAM user. It augments the **Lambda execution role** CloudFormation creates for functions in this stack.

| Piece                               | Meaning                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Effect: Allow`                     | Permit these actions (everything else on DynamoDB is denied by default).                                                                                        |
| `Action`                            | Only **`PutItem`**, **`GetItem`**, and **`Scan`**—no `DeleteTable`, `CreateTable`, or `dynamodb:*`.                                                             |
| `Resource: !GetAtt PhotosTable.Arn` | Permissions apply **only** to this table’s ARN (e.g. `arn:aws:dynamodb:us-east-1:123456789:table/photostore-learn-dev-photos`), not every table in the account. |

**How this maps to the API**

| Route                      | Handler           | DynamoDB API used | IAM action required |
| -------------------------- | ----------------- | ----------------- | ------------------- |
| `POST /photos/upload-url`  | `uploadPhotoUrl`  | —                 | —                   |
| `POST /photos`             | `createPhoto`     | `PutItem`         | `dynamodb:PutItem`  |
| `GET /photos`              | `listPhotos`      | `Scan`            | `dynamodb:Scan`     |

`GetItem` is allowed now for a future “get one photo by id” route; nothing calls it yet.

**End-to-end (`POST /photos`)**

```text
Client → API Gateway → Lambda (createPhoto)
  → reads process.env.PHOTOS_TABLE
  → AWS SDK PutItem (signed with the function’s execution role)
  → DynamoDB PhotosTable
```

If IAM were too broad (e.g. `dynamodb:*` on `*`), a bug or compromise in Lambda could touch every table in the account. Scoping to **one ARN** and **three actions** is least privilege for the current app.

**Table definition (same file, `resources`)**

`PhotosTable` is **pay-per-request** with partition key **`photoId`** (string). That matches items in `src/photos.ts` (`photoId`, `s3Key`, `caption`, `createdAt`).

### S3 wiring in `serverless.yml`

**Environment**

| Piece            | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `PHOTOS_BUCKET`  | Injected into Lambdas; `!Ref PhotosBucket` resolves to the bucket name |
| `src/s3.ts`      | `photosBucketName()` reads `process.env.PHOTOS_BUCKET`                  |

**IAM (Lambda execution role)**

```yaml
- Effect: Allow
  Action:
    - s3:PutObject
  Resource: !Sub "${PhotosBucket.Arn}/*"
```

Only **`PutObject`** on objects in this bucket—enough to mint presigned PUT URLs. No public read; viewing images via presigned GET comes in a later stretch goal. See [S3 presigned URLs](#s3-presigned-urls-how-upload-signing-works) for how signing works end-to-end.

**Bucket (`PhotosBucket` under `resources`)**

| Setting                         | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `PublicAccessBlockConfiguration` | Block all public access                            |
| `BucketEncryption` (SSE-S3)     | Encrypt objects at rest                              |
| `CorsConfiguration`               | Allow browser `PUT` directly to presigned URLs       |

CloudFormation assigns the bucket name (no hard-coded global name). Find it after deploy: Lambda env `PHOTOS_BUCKET`, or **S3 → Buckets** in the console.

**How routes use S3**

| Route                      | Handler           | S3 usage                                      |
| -------------------------- | ----------------- | --------------------------------------------- |
| `POST /photos/upload-url`  | `uploadPhotoUrl`  | `getSignedUrl` for `PutObject` on `photos/{id}.jpg` |
| `POST /photos`             | `createPhoto`     | None (metadata only; bytes already in S3)     |
| `GET /photos`              | `listPhotos`      | None (returns `s3Key`; no download URL yet)    |

**End-to-end upload**

```text
Client → POST /photos/upload-url → Lambda returns { photoId, s3Key, uploadUrl }
Client → PUT uploadUrl (direct to S3; bytes bypass API Gateway)
Client → POST /photos { photoId, s3Key, caption } → DynamoDB PutItem
Client → GET /photos → Scan metadata (includes s3Key per row)
```

### S3 presigned URLs (how upload signing works)

This is the mechanism behind **`POST /photos/upload-url`**. The client never receives your AWS access keys; it receives a **time-limited HTTPS URL** that already contains permission to perform **one kind of S3 operation** on **one object**.

#### Problem presigning solves

| Approach | Issue |
| -------- | ----- |
| Send file through API Gateway → Lambda → S3 | ~10 MB API limit, expensive Lambda memory/time, slow |
| Give the browser your AWS credentials | Never safe; full account access if leaked |
| Make the bucket public for `PUT` | Anyone on the internet could upload garbage |
| **Presigned URL** | Lambda (trusted) signs a **narrow, temporary** upload; client uploads **directly to S3** |

#### Who has credentials?

```text
┌─────────────────┐     IAM role: s3:PutObject      ┌──────────────────┐
│ Lambda          │     on PhotosBucket/* only      │ S3 (private)     │
│ uploadPhotoUrl  │ ──────────────────────────────► │ photos/{id}.jpg  │
└────────┬────────┘                                 └────────▲─────────┘
         │ getSignedUrl()                                      │
         │ (uses execution role creds)                         │ PUT + signed query string
         ▼                                                     │
┌─────────────────┐   uploadUrl (no AWS keys)        ┌────────┴─────────┐
│ Client          │ ────────────────────────────────►│ S3 validates     │
│ curl / browser  │                                  │ signature        │
└─────────────────┘                                  └──────────────────┘
```

1. **Lambda** runs with the **execution role** from `serverless.yml` (`s3:PutObject` on your bucket only).
2. **`getSignedUrl`** (AWS SDK) builds a `PutObject` request in memory and **signs** it with those role credentials.
3. The SDK returns a normal HTTPS URL (bucket hostname + object key + **query parameters** that carry the signature).
4. The **client** issues `PUT` to that URL. **S3** (not Lambda) receives the bytes and checks the signature, expiry, and headers.

The client never calls `aws configure` and never sees `AWS_ACCESS_KEY_ID` for your account.

#### What is “in” a presigned URL?

The URL looks like ordinary S3 HTTPS, with extra query params (names vary slightly by SDK version), for example:

```text
https://<bucket>.s3.<region>.amazonaws.com/photos/<photoId>.jpg
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=...%2F<date>%2F<region>%2Fs3%2Faws4_request
  &X-Amz-Date=...
  &X-Amz-Expires=300
  &X-Amz-SignedHeaders=content-type%3Bhost
  &X-Amz-Signature=<hex>
```

| Piece | Meaning |
| ----- | ------- |
| Path | Exact **object key** (`photos/{photoId}.jpg`) — client cannot change key without invalidating the signature |
| `X-Amz-Expires` | Lifetime in seconds (this repo: **300** = 5 minutes, see `UPLOAD_URL_EXPIRES_SECONDS` in `src/s3.ts`) |
| `X-Amz-SignedHeaders` | Headers that must match on the real `PUT` (here: **`host`** and **`content-type`**) |
| `X-Amz-Signature` | Cryptographic proof that something with `s3:PutObject` on this object created the URL |

If the client changes the key, uses `POST` instead of `PUT`, sends the wrong `Content-Type`, or waits past expiry, S3 returns **403 Forbidden** (often `SignatureDoesNotMatch` or `Request has expired`).

#### What this repo signs (code)

In `src/photos.ts`, `uploadUrl` builds a **`PutObject`** command and passes it to the presigner:

```ts
await getSignedUrl(
  s3Client,
  new PutObjectCommand({
    Bucket: photosBucketName(),
    Key: s3Key,                        // e.g. photos/<uuid>.jpg
    ContentType: body.data.contentType, // must match the client PUT header
  }),
  { expiresIn: UPLOAD_URL_EXPIRES_SECONDS },
);
```

| Field in command | Why it matters |
| ---------------- | -------------- |
| `Bucket` | Must be your private `PhotosBucket` |
| `Key` | Locks upload to one path; returned to client as `s3Key` for DynamoDB |
| `ContentType` | Baked into signature — client **must** send the same `Content-Type` on `PUT` |

The handler also generates **`photoId`** and **`s3Key`** before signing so step 3 (`POST /photos`) can store the same identifiers in DynamoDB after the upload.

#### Client `PUT` requirements

After `POST /photos/upload-url`:

```bash
curl -X PUT \
  -H "Content-Type: image/jpeg" \
  --data-binary @photo.jpg \
  "$UPLOAD_URL"
```

- Use **`PUT`**, not `POST` (this app presigns `PutObject`, not multipart POST policy).
- **`Content-Type`** must match what you sent to `/photos/upload-url` (default `image/jpeg`).
- Body is the **raw file bytes** (not JSON wrapping the file).
- Upload must finish **before** `expiresInSeconds` (300s).

#### Presigned PUT vs presigned POST (not used here)

| | Presigned **PUT** (this repo) | Presigned **POST** (multipart form) |
| - | ----------------------------- | ----------------------------------- |
| Client sends | Raw body with `PUT` | `multipart/form-data` with fields + file |
| Typical use | Simple APIs, mobile, curl | Browser uploads with form posts |
| Our code | `PutObjectCommand` + `getSignedUrl` | Would use `createPresignedPost` instead |

#### CORS and presigning

Presigning is **authorization**. **CORS** is separate: the browser still checks whether S3 allows your web app’s origin to read the response from `PUT`. `PhotosBucket` in `serverless.yml` sets `CorsConfiguration` with `PUT` and `HEAD` so a future SPA on `localhost:5173` (or similar) can upload without the API proxying bytes. **curl** ignores CORS.

#### Security in *this* learning stack

- The bucket stays **private**; the URL is not a public bucket policy.
- Each URL is **scoped** to one key and one HTTP method (`PUT`).
- URLs **expire** quickly.
- **Gap (fixed in step 6–7):** anyone who can hit your HTTP API can still call `/photos/upload-url` and get a valid upload URL. Cognito + JWT on the API will tie presigning to logged-in users; step 8 will prefix keys with `users/{sub}/`.

#### Common failures

| Symptom | Likely cause |
| ------- | ------------- |
| `403` / `SignatureDoesNotMatch` | Wrong `Content-Type`, changed URL, or used `POST` instead of `PUT` |
| `403` / request expired | Waited longer than `expiresInSeconds` |
| `403` from API (not S3) | Calling `uploadUrl` without deploy / wrong API URL |
| CORS error in browser only | Bucket CORS or missing `Content-Type` on preflight/PUT |
| Upload works but “empty” gallery | Forgot step 3 — `POST /photos` with same `photoId` and `s3Key` |

#### Verify in AWS Console

After a successful `PUT`:

1. **S3** → your photos bucket → prefix `photos/` → object with your `photoId` in the key.
2. **DynamoDB** → `photostore-learn-dev-photos` → item with matching `photoId` and `s3Key` (after step 3).

Object is not world-readable; downloading for display needs a future presigned **GET** or CloudFront (stretch goal).

### CloudWatch (debugging endpoints)

With this stack (**HTTP API → Lambda**), **CloudWatch Logs** is the main way to debug deployed endpoints after you call `GET /hello` (or any route you add later).

**What gets logged automatically**

| Source          | What you see                                                                       | This repo                                         |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Lambda**      | `console.log` / `console.error`, uncaught errors, timeouts, runtime start/end      | On by default for every invocation                |
| **API Gateway** | Access logs, execution logs (requests that never reach Lambda, integration errors) | Off unless you configure them in `serverless.yml` |

Most endpoint issues show up in **Lambda logs**. Turn on API Gateway logging only if you need to debug routing, CORS, or auth **before** the function runs.

**Log group name**

After deploy, Lambda writes to a log group shaped like:

```text
/aws/lambda/{service}-{stage}-{functionKey}
→ /aws/lambda/photostore-learn-dev-hello
```

(`service` and `stage` come from `serverless.yml`; `functionKey` is `hello` under `functions`.)

**Where to look**

1. **AWS Console:** CloudWatch → **Log groups** → open `photostore-learn-dev-hello` → pick the latest **log stream** after a request.
2. **Terminal (tail):**

```bash
npx serverless logs -f hello -t
```

(`-t` follows new lines; requires a prior `npx serverless deploy`.)

3. **AWS CLI:**

```bash
aws logs tail "/aws/lambda/photostore-learn-dev-hello" --follow
```

**Debugging workflow**

1. Deploy (`npx serverless deploy`).
2. Hit the endpoint (browser, Postman, or `curl` using the HTTP API URL from deploy output).
3. Open the Lambda log group or run `npx serverless logs -f hello -t`.
4. Check:
   - **No log line** → wrong URL/stage, or deploy did not update the function you think it did.
   - **Error stack / `Task timed out`** → exception or timeout in `src/handler.ts`.
   - **Your `console.log` output** → path, query string, custom fields you added.

**Add logging in the handler**

Anything you log from `src/handler.ts` appears in CloudWatch. Example:

```ts
console.log("hello request", {
  routeKey: event.routeKey,
  path: event.rawPath,
  query: event.queryStringParameters,
});
```

Redeploy after changing the handler so logs reflect the new code.

**Search many requests (Logs Insights)**

In the console: CloudWatch → **Logs Insights** → select the `photostore-learn-dev-hello` log group. Example query:

```sql
fields @timestamp, @message
| filter @message like /error/i
| sort @timestamp desc
| limit 50
```

**Tips**

- **Source maps:** `custom.esbuild.sourcemap: true` in `serverless.yml` helps stack traces map back to TypeScript.
- **Structured logs:** `console.log(JSON.stringify({ level: "info", ... }))` makes Insights filters easier than plain strings.
- **Local vs deployed:** fix syntax and small bugs locally first; use CloudWatch for behavior that only appears in AWS (IAM, env vars, real API Gateway events).

### CORS

**Same origin**

Two URLs share an origin when **scheme + host + port** all match:

| Page                      | API                             | Same origin? |
| ------------------------- | ------------------------------- | ------------ |
| `https://api.example.com` | `https://api.example.com/hello` | Yes          |
| `https://app.example.com` | `https://api.example.com/hello` | No (host)    |
| `http://api.example.com`  | `https://api.example.com/hello` | No (scheme)  |

**Why `httpApi.cors: true`**

Browser JavaScript from another origin (e.g. a future React app on `localhost:5173`) cannot read API responses unless the API returns CORS headers. With CORS enabled, API Gateway can respond to **OPTIONS** preflight and attach `Access-Control-Allow-*` on the real **GET**.

**Typical sequences**

- **curl / Postman:** no CORS (not a browser enforcing origin).
- **Browser on same host as API:** often simple GET without preflight.
- **Browser SPA on different host:** `OPTIONS` → then `GET` with CORS headers.

### S3, DynamoDB & CloudFront

**Planned data model (photo app)**

| Store        | Holds                                                               | Why                                         |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------- |
| **S3**       | JPEG/PNG bytes                                                      | Cheap, durable object storage for files     |
| **DynamoDB** | `photoId`, `s3Key`, `caption`, `createdAt`, later `ownerId` (`sub`) | Query “my photos,” list by user, small rows |
| **Lambda**   | Upload URL minting, metadata writes, auth checks                    | Short-lived logic; not a file store         |

Do **not** store large images in DynamoDB or in the Lambda package.

**Upload flow (implemented — step 5)**

```text
1. Client → POST /photos/upload-url (Lambda)
   ← presigned PUT URL + photoId + s3Key (e.g. photos/{uuid}.jpg)

2. Client → PUT file directly to S3 (bytes never through API Gateway)

3. Client → POST /photos (Lambda) with { photoId, s3Key, caption }
   → DynamoDB PutItem

4. Client → GET /photos (Lambda) → Scan (later: Query by ownerId)

5. View image: presigned GET to S3, or CloudFront signed URL (stretch — step 9)
```

See [Photo upload flow](#photo-upload-flow-step-5) for `curl` examples.

API Gateway has a **~10 MB** payload limit; direct-to-S3 upload avoids that and reduces Lambda memory/time.

**S3 bucket settings in this repo**

- **Block all public access** — configured on `PhotosBucket`.
- **CORS** — `PUT` / `HEAD` allowed for browser uploads to presigned URLs.
- **SSE-S3** — default encryption on the bucket.
- **Key pattern today:** `photos/{photoId}.jpg` (or `.png` / `.webp`). **Later (step 8):** `users/{ownerId}/photos/{photoId}.jpg`.

**DynamoDB (implemented — step 4)**

- Table: `photostore-learn-dev-photos`, key **`photoId`** (string). Routes: **`POST /photos`**, **`GET /photos`**.
- Wiring: [DynamoDB in `serverless.yml`](#dynamodb-wiring-in-serverlessyml) (`PHOTOS_TABLE` env + IAM on table ARN).
- Later: GSI on `ownerId` when Cognito `sub` is in play; replace `Scan` with `Query` for “my photos only.”

**S3 (implemented — step 5)**

- Private bucket via `PhotosBucket`; presigned upload via **`POST /photos/upload-url`**.
- Wiring: [S3 in `serverless.yml`](#s3-wiring-in-serverlessyml) (`PHOTOS_BUCKET` env + `s3:PutObject` on bucket objects).

**CloudFront—when to add it**

| Stay on presigned S3 GET     | Add CloudFront                     |
| ---------------------------- | ---------------------------------- |
| Learning, low traffic        | Many readers, global users         |
| Simplest IAM                 | Custom domain `cdn.example.com`    |
| Short-lived URLs per request | Edge caching of popular thumbnails |

Not in the repo yet (learning path step 9). Core app works without it.

**Migrating S3 → CloudFront later**

Keep **`s3Key`** in DynamoDB, not permanent `https://bucket.s3.amazonaws.com/...` strings. One function builds view URLs; switch implementation from S3 presigned GET to CloudFront signed URL. Bucket stays private; add **Origin Access Control** so only CloudFront reads objects.

**CloudFront use cases (summary)**

- Cache static assets and images at edge locations.
- HTTPS and custom domain in front of private S3.
- Reduce origin load and latency for repeat views.
- Optional WAF, compression, HTTP/2 at the edge.
