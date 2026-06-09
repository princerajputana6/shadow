# Deploying AgentOS — monorepo to Vercel + Railway

This repo has two apps:

- **Next.js dashboard** at the repo root → deploy to **Vercel**
- **Express agent runner** in `runner/` → deploy to **Railway**

They share `MongoDB Atlas` (one database), and a shared `RUNNER_SECRET` for HTTP auth between them.

---

## 1. Deploy the runner to Railway first

Railway gives you the runner's public URL, which Vercel needs as an env var.

### Steps

1. Push the repo to GitHub.
2. Go to https://railway.app/new → **Deploy from GitHub repo**.
3. Pick this repo.
4. After the project is created, open the service settings.
5. Either rely on the included `railway.json` (which already points Railway at the `runner/` subdir), **or** set these manually if `railway.json` isn't picked up:
   - **Root directory:** `runner`
   - **Build command:** `npm ci`
   - **Start command:** `npm start`
   - **Healthcheck path:** `/health`
6. Add these environment variables in the Railway dashboard (Variables tab):

| Variable | Source |
|---|---|
| `MONGODB_URI` | Your MongoDB Atlas SRV URI |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `TAVILY_API_KEY` | tavily.com (free tier) |
| `HUNTER_API_KEY` | hunter.io (free tier) |
| `TOKEN_ENC_KEY` | `openssl rand -base64 48` — must match Vercel |
| `RUNNER_SECRET` | `openssl rand -base64 36` — must match Vercel |
| `GOOGLE_CLIENT_ID` | Same as Vercel |
| `GOOGLE_CLIENT_SECRET` | Same as Vercel |
| `GITHUB_CLIENT_ID` | Same as Vercel |
| `GITHUB_CLIENT_SECRET` | Same as Vercel |
| `CLAUDE_MODEL` (optional) | e.g. `claude-haiku-4-5` |
| `PORT` | Set to whatever Railway tells you, typically auto-injected |

7. Deploy. Railway prints a public URL like `https://agentos-runner-production.up.railway.app`. Copy this for the next step.
8. Confirm it's up: visit `<your-railway-url>/health` — should return `{"ok":true,"ts":...}`.

---

## 2. Deploy the Next.js app to Vercel

### Steps

1. Go to https://vercel.com/new → **Import Git Repository** → pick this repo.
2. Vercel auto-detects Next.js at the repo root. **Don't change the Root Directory** — leave it as the repo root.
3. Framework preset: **Next.js**. Build command and output directory: defaults.
4. Add these env variables (Settings → Environment Variables):

| Variable | Value |
|---|---|
| `MONGODB_URI` | Same as Railway |
| `NEXTAUTH_URL` | Your Vercel URL, e.g. `https://agentos.vercel.app` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 48` |
| `TOKEN_ENC_KEY` | **Same** as Railway |
| `RUNNER_SECRET` | **Same** as Railway |
| `AGENT_RUNNER_URL` | Your Railway URL (no trailing slash), e.g. `https://agentos-runner-production.up.railway.app` |
| `ANTHROPIC_API_KEY` | Same as Railway |
| `TAVILY_API_KEY` | Same as Railway |
| `HUNTER_API_KEY` | Same as Railway |
| `GOOGLE_CLIENT_ID` | Same as Railway |
| `GOOGLE_CLIENT_SECRET` | Same as Railway |
| `GOOGLE_REDIRECT_URI` | `https://agentos.vercel.app/api/auth/callback/google` |
| `GITHUB_CLIENT_ID` | Same as Railway |
| `GITHUB_CLIENT_SECRET` | Same as Railway |

5. Deploy.

---

## 3. Post-deploy: update OAuth callback URLs

After Vercel gives you a real domain (e.g. `agentos.vercel.app`), you must update the redirect URIs in your OAuth apps:

### Google OAuth (https://console.cloud.google.com/apis/credentials)

Add this to the **Authorized redirect URIs** of your OAuth 2.0 Client:

```
https://agentos.vercel.app/api/auth/callback/google
```

Keep `http://localhost:3000/api/auth/callback/google` for local dev.

### GitHub OAuth (https://github.com/settings/applications)

Open your OAuth App → **Authorization callback URL**. GitHub only allows ONE callback URL per app, so you'll need either:
- A dev OAuth App pointing to `http://localhost:3000/api/integrations/github/callback`
- A prod OAuth App pointing to `https://agentos.vercel.app/api/integrations/github/callback`
- Use separate env vars (`GITHUB_CLIENT_ID_DEV` vs `GITHUB_CLIENT_ID_PROD`) per environment

Easiest: just create two OAuth Apps and swap which credentials each deployment uses.

---

## 4. Verify end-to-end

1. Open `https://agentos.vercel.app/login`
2. Sign in with Google
3. Open Settings → "GitHub connection" → Connect GitHub
4. Open Tasks → Sync GitHub repos
5. Open Dashboard → Click the Shadow orb → ask "what's my dashboard"
6. Click "Run now" on the Sales Finder card → check the Railway logs to see the runner pick up the job

---

## Common gotchas

- **"MONGODB_URI is not set" in Railway** — you forgot to set the env var. Service won't even start; logs will show the error.
- **NextAuth "Access Denied" on Google sign-in in production** — your Google OAuth callback URL doesn't match `NEXTAUTH_URL`. Update either the env var or the OAuth app.
- **Sales agent can't reach runner** — `AGENT_RUNNER_URL` in Vercel is wrong, or `RUNNER_SECRET` doesn't match. Check both.
- **Cold-start delay on first request** — Vercel hibernates idle serverless functions; Railway hibernates idle services on Hobby tier. First request takes ~3s; subsequent are fast. For production: pay for the Pro tier on either or both.
- **Mongoose discriminator errors** — only happens if both Vercel and Railway are concurrently writing to the same schema-versioned collection. Fix: bump `mongoose` to the same version in both `package.json` and `runner/package.json`.
- **`onmessage`/SpeechRecognition not working in production** — HTTPS is required for browser mic access, but Vercel gives you HTTPS automatically. Should just work.
