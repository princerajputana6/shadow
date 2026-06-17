# Shadow on n8n — architecture

Full n8n-native rebuild of the agentic platform. The Express `runner/` and its
`node-cron` jobs are **retired**; every agent becomes an n8n workflow built from
native **AI Agent** nodes. n8n is self-hosted in Docker (queue mode). MongoDB
stays as the single source of truth for app data.

```
┌─────────────┐    server action / fetch     ┌──────────────────────────────┐
│  Next.js    │ ───────────────────────────▶ │  n8n  (main)                 │
│  app :3000  │   POST /webhook/<agent>      │  • Webhook + Schedule trigger │
│  UI / OAuth │ ◀─────────────────────────── │  • enqueues run → Redis       │
└─────┬───────┘    202 {status:'started'}    └──────────────┬───────────────┘
      │                                                      │ Bull queue
      │ reads runs/results                          ┌────────▼───────────┐
      ▼                                             │  n8n worker(s)     │
┌─────────────┐ ◀───────── read/write ───────────  │  AI Agent + tools  │
│  MongoDB    │            (MongoDB node)           └────────┬───────────┘
│  Atlas      │                                              │ Anthropic / Tavily / Hunter
└─────────────┘                                       Gmail / GitHub (per-user token)
```

Two ways a workflow starts:
- **Webhook trigger** — replaces each `runner` HTTP endpoint. The Next app calls
  `POST {WEBHOOK_URL}/webhook/discovery` with `{ userId, businessId }`.
- **Schedule trigger** — replaces `node-cron`:
  | old cron | n8n Schedule Trigger | workflow |
  |---|---|---|
  | `30 0 * * *` (6 AM IST) | daily 06:00 Asia/Kolkata | Sales |
  | `0 */12 * * *` | every 12h | Social |
  | `15 */6 * * *` | every 6h | Discovery |

  Scheduled workflows start with a **MongoDB node** that lists active users/businesses,
  then a **Loop / Split-in-Batches** that runs the per-tenant sub-workflow for each.

## The agents → workflows

Each agent is one workflow. All of them share a tiny **`util:agent-run`** sub-workflow
that creates the `AgentRun` doc (`status:'running'`), and on completion patches it to
`completed`/`failed` with `stats` — exactly what the dashboard reads today.

| Workflow | Trigger | Core nodes |
|---|---|---|
| **Discovery** (`sales_finder`) | webhook + 6h schedule | Mongo(business) → build queries (Code) → HTTP(Tavily) → **AI Agent** extract/qualify prospect → HTTP(Hunter) enrich → Mongo upsert(Prospect) |
| **Enrichment** | webhook | Mongo(prospects missing email) → HTTP(Hunter) → Mongo update |
| **Sales** (`sales_finder`) | webhook + daily schedule | Mongo(approved prospects) → decrypt Gmail token (Code) → HTTP(Gmail send) → poll replies → **AI Agent** qualify intent → HTTP(Calendar book) → Mongo(Lead/Meeting) |
| **Social** (`social_media`) | webhook + 12h schedule | Mongo(business) → **AI Agent** draft 5 posts (structured output) → Mongo insert(SocialPost) |
| **CTO** (`cto`) | webhook | Mongo(Task) → **AI Agent** plan → write `filesToModify` to Task |
| **Developer** (`developer`) | webhook | Mongo(Task+Repo) → decrypt GitHub token → HTTP(GitHub tree/files) → **AI Agent** generate diff → HTTP(GitHub create branch + draft PR) |

### AI Agent node setup (native)
- **Chat model**: *Anthropic Chat Model* sub-node → model `claude-haiku-4-5`
  (Developer/CTO use `claude-sonnet-4-5`). Credential = your `ANTHROPIC_API_KEY`.
- **Output parser**: *Structured Output Parser* with the same JSON shape your code
  expects today (e.g. discovery: `{company, email, signal, isCompetitor}`).
- **Tools attached to the agent**: HTTP Request Tool (Tavily, Hunter), and for
  per-user actions a **sub-workflow tool** that does decrypt-token → HTTP call.

### The per-user OAuth pattern (important)
Gmail/GitHub tokens are AES-256-GCM encrypted in Mongo with `TOKEN_ENC_KEY`. n8n's
native Gmail/GitHub credentials can't read them, so **don't** use those nodes for
tenant actions. Instead, a **Code node** decrypts on the fly and an **HTTP Request**
node makes the call with `Authorization: Bearer <token>`:

```js
// Code node — decrypt a user's stored token (mirrors runner/lib/crypto.js)
const { createDecipheriv, createHash } = require('crypto');
function decrypt(payload) {
  if (!payload) return '';
  const key = createHash('sha256').update($env.TOKEN_ENC_KEY).digest();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
return [{ json: { accessToken: decrypt($json.googleTokens.accessToken) } }];
```

(OAuth *connect* flows stay in the Next app — the existing
`/api/integrations/*` callbacks already store tokens. n8n only consumes them.)

## What changes in the Next.js app
1. Server actions stop calling the runner; they `POST {WEBHOOK_URL}/webhook/<agent>`
   with the same body + an `x-runner-secret`-style shared header (a webhook
   "Header Auth" credential in n8n).
2. Point `AGENT_RUNNER_URL` at n8n's webhook base, or add `N8N_WEBHOOK_URL`.
3. Reading results is unchanged — the dashboard already reads `AgentRun`/`Prospect`
   from Mongo, which the workflows write.

## Bonus you get for free with native n8n
- **Token/cost tracking** (the thing that wasn't implemented): the Anthropic node
  exposes `usage` per call → write `inputTokens`/`outputTokens` into `AgentRun.stats`.
- Built-in **retries, error workflows, execution history**, and a visual run log.

## Migration phases
1. **Stand up n8n** — `docker compose up`, set encryption key, log in at :5678. *(scaffolded here)*
2. **Build `util:agent-run`** sub-workflow + Mongo connection.
3. **Port Discovery first** (read-only-ish, no per-user OAuth) — validate end to end.
4. **Port Social, CTO** (Claude-only, no OAuth).
5. **Port Sales, Developer** (need the decrypt-token pattern).
6. **Repoint Next.js** server actions to webhooks; delete `runner/`.
7. **Deploy** the compose to Railway; set `WEBHOOK_URL` to the public host.

## Run it
```bash
cd n8n
cp .env.example .env          # fill secrets (openssl rand -hex 32 for N8N_ENCRYPTION_KEY)
docker compose --env-file .env up -d
open http://localhost:5678
```
