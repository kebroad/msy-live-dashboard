# MSY Live Dashboard

A low-infrastructure dashboard that tracks the **concurrent viewer count** of a
single YouTube live stream over time. It uses the [git scraping](https://simonwillison.net/2020/Oct/9/git-scraping/)
pattern: a GitHub Action polls the YouTube Data API every ~5 minutes, commits the
sample to `data/viewers.csv`, then builds a React dashboard and deploys it to
GitHub Pages.

No server, no database, no cloud bill (on a public repo).

Tracks: [MSY New Orleans LIVE 24/7](https://www.youtube.com/watch?v=MH0_mPt-VXE) (`MH0_mPt-VXE`)

## Stack

- **Data collection:** Python (stdlib only) → `scripts/fetch_viewers.py`
- **Storage:** `data/viewers.csv` (`unix_seconds,viewers`), committed to git
- **Dashboard:** React + Vite + [Tremor](https://tremor.so/) (charts, KPI cards,
  and a `DateRangePicker` with presets **and** custom date ranges)
- **CI/CD:** one GitHub Actions workflow that fetches, commits, builds, and deploys

## How it works

```
GitHub Actions (every 5 min)
  ├─ scripts/fetch_viewers.py   -> appends a row to data/viewers.csv (committed)
  ├─ vite build                 -> static React app in dist/
  ├─ copy data/ into dist/      -> latest data shipped same-origin (no CORS)
  └─ deploy-pages               -> https://<you>.github.io/msy-live-dashboard/
```

The dashboard fetches `data/viewers.csv` at runtime and auto-refreshes every 2
minutes, so an open tab keeps updating as new deploys land. Offline/hidden-count
samples are stored as blanks and render as gaps, not fake zeros.

## Setup

### 1. Push to GitHub (make it public for free Actions minutes)

```bash
git remote add origin git@github.com:<you>/msy-live-dashboard.git
git push -u origin main
```

> **Public repo = unlimited free Actions minutes.** A private repo at this cadence
> would burn through the free tier and start billing.

### 2. Add your API key as a repository secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `YOUTUBE_API_KEY`
- Value: your Google Cloud API key (YouTube Data API v3 enabled)

Optionally set a repository **variable** `VIDEO_ID` to track a different stream
(defaults to `MH0_mPt-VXE`).

### 3. Enable GitHub Pages (Actions deployment)

Repo → **Settings → Pages** → Source: **GitHub Actions**.

> If the repo name differs from `msy-live-dashboard`, update `base` in
> `vite.config.ts` to `"/<your-repo-name>/"` so asset paths resolve.

### 4. Run it once manually

Repo → **Actions → "Fetch, build & deploy" → Run workflow**. This writes the first
data point and publishes the site at `https://<you>.github.io/msy-live-dashboard/`.

## Local development

```bash
npm install
export YOUTUBE_API_KEY="your-key-here"
python3 scripts/fetch_viewers.py   # add a few real samples (optional)
npm run dev                        # http://localhost:5173/msy-live-dashboard/
```

The Vite dev server serves `data/viewers.csv` straight from the repo, matching
production behavior. Other scripts: `npm run build`, `npm run preview`,
`npm run typecheck`.

## Cost

Sampling every 5 minutes ≈ 8,640 runs/month. On a **public repo this is free**
(unlimited Actions minutes). Each run does a fetch + a ~3s Vite build + deploy.

## Known caveats

- **Cron is best-effort.** GitHub's minimum interval is 5 minutes and runs can be
  delayed or skipped under load. Expect roughly-5-minute granularity.
- **Scheduled workflows auto-disable after 60 days of repo inactivity.** Commits
  made by the default `GITHUB_TOKEN` may not reset this timer. If the job goes
  quiet, re-enable it in the Actions tab, or push the data commit with a Personal
  Access Token instead of `GITHUB_TOKEN`.
- `concurrentViewers` is only present while the stream is **live** and the owner
  has not hidden the count.

## Want 1-minute resolution?

GitHub cron can't go below 5 minutes, but one 5-minute job can sample internally
every 60s (`sleep 60` loop ×5) and commit all points at once. Ask and it can be
wired up.
