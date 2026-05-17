# photostore-learn

AWS Serverless learning project: **Lambda**, **API Gateway (HTTP API)**, **DynamoDB**, **S3**, and **Amazon Cognito**—step by step (not all implemented yet).

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
- **Lambda:** `hello` → deployed name `photostore-learn-dev-hello`
- **API:** HTTP API, **`GET /hello`**, CORS enabled for future browser clients

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

### 5. S3 (binary) + connect to Dynamo

Private bucket, **presigned upload URL**; then **`POST`** (or “complete upload”) to store **`s3Key` + caption** (and later **`ownerId`**) in Dynamo.

**Why after Dynamo:** rows are the index; S3 is where the bytes live.

### 6. Cognito User Pool (identity)

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

Notes on **AWS** and this project’s stack (Lambda, API Gateway, Serverless, S3, DynamoDB, CloudFront).

| Topic                            | Section                                  |
| -------------------------------- | ---------------------------------------- |
| AWS account & billing            | [Below](#aws-account--billing)           |
| IAM & deploy permissions         | [Below](#iam--deploy-permissions)        |
| Serverless Framework             | [Below](#serverless-framework)           |
| Deploy, CloudFormation & cleanup | [Below](#deploy-cloudformation--cleanup) |
| API Gateway & HTTP               | [Below](#api-gateway--http)              |
| CORS                             | [Below](#cors)                           |
| S3, DynamoDB & CloudFront        | [Below](#s3-dynamodb--cloudfront)        |

### AWS account & billing {#aws-account--billing}

- **Free tier:** New accounts get **AWS Free Tier** (12‑month and always‑free caps on selected services). Billing is still **pay‑as‑you‑go** outside those caps; a payment method is usually required.
- **Cost control:** Use billing alerts/budgets and run **`npx serverless remove`** when an experiment is finished.

### IAM & deploy permissions {#iam--deploy-permissions}

- Day-to-day work should use an **IAM user** or **role**, not the **root** user.
- Deploying this stack requires permission to manage **CloudFormation**, **Lambda**, **API Gateway**, **DynamoDB**, **S3**, and **IAM roles for Lambda**. **`PowerUserAccess` alone is often insufficient** because it restricts IAM role management.
- **`AdministratorAccess`** is common for personal learning accounts; production or shared org accounts should use a **sandbox** or a **scoped deploy policy**.

### Serverless Framework {#serverless-framework}

- This repo pins **Serverless v3** in `package.json`. Use **`npx serverless`** or **`npm run print`** so commands do not pick up a global **v4** install (v4 may require a Serverless.com login).

### Deploy, CloudFormation & cleanup {#deploy-cloudformation--cleanup}

- **`serverless deploy`** creates/updates a **CloudFormation stack** (Lambda, IAM execution role, HTTP API, etc.).
- **Lambda naming:** deployed name = **`{service}-{stage}-{functionKey}`** (e.g. `photostore-learn` + `dev` + `hello` → `photostore-learn-dev-hello`). That string is not hard-coded in the repo.
- **Deploy output** lists each function with its AWS name and package size (e.g. `156 kB`).
- **`serverless remove`** deletes the stack and its AWS resources. **Local source code is not deleted.** A later **`deploy`** publishes whatever is in the project at that time.

### API Gateway & HTTP {#api-gateway--http}

- **`functions.hello` + `httpApi`:** defines Lambda `hello` (`handler.hello` in `handler.js`) and exposes **`GET /hello`** on an **HTTP API** (v2). **`provider.httpApi.cors`** enables CORS for browser clients.
- **Request flow:** client → **HTTP API** → **Lambda** → handler returns `{ statusCode, headers, body }` → API Gateway → client.
- **Lambda `event`:** HTTP API **payload format 2.0** (`routeKey`, `rawPath`, `queryStringParameters`, `requestContext.http`, etc.). See [AWS HTTP API Lambda proxy](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html).
- **Invoke URL:** `https://<api-id>.execute-api.<region>.amazonaws.com` plus route path (e.g. `/hello`). Printed by **`deploy`** / **`serverless info`** or in the API Gateway console.

### CORS {#cors}

- **Same origin** = same scheme, host, and port. Cross-origin browser `fetch` may send an **OPTIONS** preflight before **GET**/**POST**; `httpApi.cors: true` lets API Gateway answer preflight for allowed origins.

### S3, DynamoDB & CloudFront {#s3-dynamodb--cloudfront}

- **Photos:** store bytes in **S3**; store **metadata** in **DynamoDB** (`s3Key`, caption, later `ownerId`). Typical pattern: private bucket, **presigned PUT** upload, row in DynamoDB, **presigned GET** (or CloudFront later) for viewing.
- **CloudFront** is optional (learning path step 9): not required for the core app. Add it for edge caching, custom domains, and serving private S3 via **OAC** + signed URLs.
- **S3 → CloudFront later:** straightforward if DynamoDB stores **`s3Key`** (not long-lived S3 URLs) and view URLs are built in one place. Objects stay in the same bucket.
- **CloudFront fits:** global caching, origin offload, HTTPS/custom domain, private S3 origins, multi-origin routing, cache TTLs/invalidation, large downloads/streaming.
