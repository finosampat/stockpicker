# Deploy

Target setup: **backend on Render (free)** at `api.<your-domain>`, **frontend on Vercel** at `app.<your-domain>`, DNS at **GoDaddy**. Examples below use `patbots.com`.

## 1. Backend — Render

`render.yaml` at the repo root defines the service:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Runtime | Python 3.12 |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check | `/api/health` |

Steps:

1. Render dashboard → **New → Blueprint** → pick `finosampat/stockpicker` (Render reads `render.yaml`). Or **New → Web Service** and enter the settings above.
2. Set `CORS_ORIGINS` to your frontend origins, e.g. `https://app.patbots.com,https://stockpicker.vercel.app`.
3. Deploy, then check `https://<service>.onrender.com/api/health`.

### Free-tier notes

- **Sleep**: free web services spin down after ~15 min idle; the next request takes ~30–60 s to wake. The UI shows the loading state meanwhile. Use a paid instance or an uptime pinger hitting `/api/health` if that matters.
- **Ephemeral disk**: `backend/.cache/` is wiped on each deploy/restart, so the first full-universe match after a wake re-downloads ~520 symbols (≈30–60 s). Attach a Render Disk (paid) and set `CACHE_DIR` to its mount path to keep the cache.
- **Yahoo rate limits**: Yahoo throttles datacenter IPs. The backend batches 50 tickers per request, caches each symbol for the day, doesn't retry failed symbols until tomorrow, and falls back to stale cache. If you hit persistent 429s, lower `YF_BATCH_SIZE`, use a smaller universe (`DEFAULT_UNIVERSE=ndx`), or move to a paid data provider.

## 2. Backend — Docker / VPS (alternative)

```bash
cd backend
docker build -t stockpicker-api .
docker run -d -p 8000:8000 -v stockpicker-cache:/app/.cache \
  -e CORS_ORIGINS=https://app.patbots.com stockpicker-api
```

The volume keeps the OHLCV cache across restarts. Put it behind Caddy/Nginx for TLS on `api.patbots.com`.

## 3. Frontend — Vercel

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Env var | `VITE_API_URL=https://api.patbots.com` (or the `onrender.com` URL) |

Steps: Vercel → **Add New → Project** → import `finosampat/stockpicker` → set the root directory and env var → Deploy. `VITE_API_URL` is baked in at build time, so redeploy after changing it.

## 4. DNS — GoDaddy

GoDaddy → **My Products → DNS → Manage** for the domain, add:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `app` | `cname.vercel-dns.com` (use the exact target Vercel shows) | 1 hour |
| CNAME | `api` | `<service>.onrender.com` | 1 hour |

Then:

1. Vercel → Project → **Settings → Domains** → add `app.patbots.com`.
2. Render → Service → **Settings → Custom Domains** → add `api.patbots.com`.

Both issue TLS certificates automatically once DNS resolves (minutes to an hour). Make sure `CORS_ORIGINS` includes `https://app.patbots.com` and `VITE_API_URL` points at `https://api.patbots.com`.
