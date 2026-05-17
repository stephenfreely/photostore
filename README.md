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

---

## Questions & answers

Collected from learning sessions. Answers are summarized; details may evolve as the stack grows.

**Topics**

| Topic                                                                     | What it covers                            |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| [Project overview](#topic-project-overview)                               | Goals and where to start                  |
| [AWS account & IAM](#topic-aws-account--iam)                              | Signup, free tier, users, shared accounts |
| [AWS CLI & Serverless CLI](#topic-aws-cli--serverless-cli)                | Credentials, `npx serverless`, v3 vs v4   |
| [Deploy, CloudFormation & cleanup](#topic-deploy-cloudformation--cleanup) | `deploy`, `remove`, Lambda naming         |
| [API Gateway & HTTP requests](#topic-api-gateway--http-requests)          | Routes, URLs, request flow, `event` shape |
| [CORS & the browser](#topic-cors--the-browser)                            | Same origin, preflight                    |
| [S3, DynamoDB & CloudFront](#topic-s3-dynamodb--cloudfront)               | Photo storage and CDN                     |
| [Git & GitHub](#topic-git--github)                                        | Remote and push                           |

---

### Topic: Project overview {#topic-project-overview}

**Q: I want a simple backend to learn AWS (Serverless, DynamoDB, TypeScript, Lambdas, photo uploads). I don’t have an AWS account yet—walk me through step by step.**

**A:** Start with **no app code**. Step 1: create an AWS account, enable **MFA on root**, and plan to use an **IAM user** for day-to-day work (not root). Later: AWS CLI → Serverless → minimal deploy → add services one at a time. The full ordered path is in [Learning path](#learning-path-recommended-order) above.

---

### Topic: AWS account & IAM {#topic-aws-account--iam}

**Q: Is there a free option for AWS?**

**A:** Yes, in several senses: the **AWS Free Tier** (12‑month and always‑free caps on specific services), and **pay‑as‑you‑go** (no monthly “AWS subscription”). Free tier does **not** mean everything is free—you still need a payment method on file, and usage outside caps is billed normally. Use **billing alerts/budgets** and tear down experiments (`serverless remove`).

**Q: I signed in to AWS—what do I do now?**

**A:** (1) Enable **MFA on root** if not done. (2) Create an **IAM user** with console access; for learning, **`AdministratorAccess`** is common (tighten later). (3) Sign in as that IAM user and confirm the console works. Next: install **AWS CLI** and run `aws sts get-caller-identity`.

**Q: I’m on my colleague’s AWS as an IAM user—do I need admin access?**

**A:** You don’t need **root**, and you don’t strictly need **`AdministratorAccess`**. You need enough permission to **deploy** what Serverless creates: CloudFormation, Lambda, API Gateway, DynamoDB, S3, and **IAM roles for Lambda** (PowerUser alone is often not enough). On a shared account, ask for a **sandbox** or **scoped deploy policy**.

---

### Topic: AWS CLI & Serverless CLI {#topic-aws-cli--serverless-cli}

**Q: IAM user works / `get-caller-identity` works—what’s next?**

**A:** Install **Serverless** (this repo uses **local v3** via `npm install`). Then minimal `serverless.yml`, `npm run print`, deploy, invoke, and add API Gateway when ready.

**Q: Can you run `npm install -g serverless`?**

**A:** That installs **global Serverless v4**, which may require Serverless.com login. This repo pins **v3** in `package.json` so `npx serverless` works without that. Prefer **`npx serverless …`** in this folder.

---

### Topic: Deploy, CloudFormation & cleanup {#topic-deploy-cloudformation--cleanup}

**Q: Deploy returned `hello: photostore-learn-dev-hello (156 kB)`—what does that mean?**

**A:** Deploy succeeded. **`hello`** is the name in `serverless.yml`; **`photostore-learn-dev-hello`** is the real Lambda name (`service` + `stage` + function key). **`156 kB`** is the deployment package size. Next: `npx serverless invoke -f hello --log`.

**Q: Where is `photostore-learn-dev-hello` defined in the codebase?**

**A:** It isn’t spelled out literally. Serverless builds **`{service}-{stage}-{functionKey}`** from `service: photostore-learn`, default stage **`dev`**, and `functions.hello` → **`photostore-learn-dev-hello`**.

**Q: Explain “That deletes the stack so you’re not leaving stray resources on your colleague’s account.”**

**A:** `deploy` creates a **CloudFormation stack** (Lambda, IAM role, API, etc.). **`npx serverless remove`** deletes that stack and its resources. **Stray resources** are forgotten tutorial leftovers still billing in someone else’s account. Your **local code is unchanged**—only AWS is torn down.

**Q: If I deploy Lambda changes and run `npx serverless remove`, does that remove my changes?**

**A:** **On AWS:** yes—the deployed stack is deleted. **On your machine:** no—your repo and edits stay. A later **`deploy`** publishes whatever is in your project at that moment.

---

### Topic: API Gateway & HTTP requests {#topic-api-gateway--http-requests}

**Q: What do `serverless.yml` lines 14–20 (`functions.hello` + `httpApi`) mean?**

**A:** Declares Lambda **`hello`** with entry point **`handler.hello`** (`handler.js` → `exports.hello`), and wires **`GET /hello`** on an **HTTP API** (v2) with CORS from `provider.httpApi`.

**Q: Explain the flow as “this → calls this → …”**

**A:** **Browser/app** → `GET https://<api>.execute-api.../hello` → **API Gateway HTTP API** → **Lambda `hello`** → **`handler.hello`** → `{ statusCode, headers, body }` → API Gateway → browser.

**Q: Walk me through the stack when `/hello` is hit in a user’s browser.**

**A:** (1) Browser sends **GET /hello** (maybe **OPTIONS** first if cross-origin). (2) **HTTP API** routes to Lambda. (3) Lambda gets **payload v2.0** `event`. (4) Handler returns JSON. (5) API Gateway responds to the browser. One line: **browser → API Gateway → Lambda → JSON back**.

**Q: What is the schema of `event` in `handler.js`?**

**A:** **HTTP API Lambda proxy, payload v2.0**. Key fields: `version`, `routeKey`, `rawPath`, `rawQueryString`, `headers`, `queryStringParameters`, `pathParameters`, `body`, `isBase64Encoded`, `requestContext.http` (`method`, `sourceIp`, etc.). Reference: [HTTP API Lambda proxy integrations](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html). Other triggers use a **different** shape.

**Q: Where do I get `YOUR_API_ID` for curl?**

**A:** It’s the subdomain in the HTTP API URL. Copy the **full base URL** from **`npx serverless deploy`**, **`npx serverless info`**, or **API Gateway → Invoke URL**. This project’s base (from a successful deploy): `https://hmffn49117.execute-api.us-east-1.amazonaws.com` — use `.../hello` for `curl`.

---

### Topic: CORS & the browser {#topic-cors--the-browser}

**Q: What does “same origin” mean (re: CORS and preflight)?**

**A:** Same **scheme + host + port**. **Same-origin** `fetch` often skips CORS preflight for simple cases; **cross-origin** (e.g. SPA on another host) may send **OPTIONS** before **GET**. Address-bar navigation is not the same as scripted `fetch`.

---

### Topic: S3, DynamoDB & CloudFront {#topic-s3-dynamodb--cloudfront}

**Q: Is S3 appropriate for user-uploaded photos?**

**A:** **Yes** for file **bytes**; **DynamoDB** for metadata (caption, `s3Key`, `ownerId`). Flow: **private bucket**, **presigned PUT**, **DynamoDB row** after upload, **presigned GET** (or CloudFront later) to view.

**Q: Will this project use CloudFront?**

**A:** **Not yet** and **not required** for the core path (see learning path step 9). Use **presigned S3 GET** first; add CloudFront for CDN, custom domains, and edge caching later.

**Q: After S3 works, is migrating to CloudFront hard?**

**A:** Usually **straightforward** if you store **`s3Key`** in DynamoDB, generate view URLs in **one place**, and keep the bucket **private**. Add distribution + OAC and switch the signer—objects and keys stay put.

**Q: What are use cases for CloudFront?**

**A:** Global **latency/caching**, **offloading origin**, **HTTPS + custom domains**, **private S3 + signed URLs**, **one front door** to multiple backends, **cache/invalidation**, **streaming/large downloads**. For learning, presigned S3 is often enough at first.

---

### Topic: Git & GitHub {#topic-git--github}

**Q: I need this on GitHub / my GitHub name is `stephenfreely`.**

**A:** Remote: **`https://github.com/stephenfreely/photostore`**. Create an empty repo on GitHub, then `git remote add origin …` and `git push -u origin main` (HTTPS or SSH with your username).
