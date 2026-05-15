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

## Hygiene on shared / colleague accounts

Use **`npx serverless remove`** when an experiment is done so you do not leave Lambdas, APIs, and roles behind in someone else’s account (unless they use a long-lived sandbox).
