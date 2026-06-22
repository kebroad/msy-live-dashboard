# MSY Live Dashboard

A zero-infrastructure dashboard that tracks the **concurrent viewer count** of a
single YouTube live stream over time. It uses the [git scraping](https://simonwillison.net/2020/Oct/9/git-scraping/)
pattern: a GitHub Action polls the YouTube Data API every ~5 minutes, commits the
sample to `data/viewers.csv`, and a static GitHub Pages site renders the history
as a Grafana-style graph.

No server, no database, no cloud bill (on a public repo).

Tracks: [MSY New Orleans LIVE 24/7](https://www.youtube.com/watch?v=MH0_mPt-VXE) (`MH0_mPt-VXE`)

## How it works

```
GitHub Actions (cron */5)  ->  scripts/fetch_viewers.py  ->  data/viewers.csv (committed)
                                                                     |
                                          GitHub Pages (index.html) reads the CSV and plots it
```

Each row in `data/viewers.csv` is `unix_timestamp,concurrent_viewers`. When the
stream is offline or the owner hides the count, `viewers` is left blank so the
graph shows a gap instead of a fake zero.

## Setup

### 1. Push this repo to GitHub (make it public for free Actions minutes)

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin git@github.com:<you>/msy-live-dashboard.git
git push -u origin main
```

> **Public repo = unlimited free Actions minutes.** A private repo at this cadence
> would burn through the free tier and start billing (~$53/mo at 5-min cadence).

### 2. Add your API key as a repository secret

Repo → **Settings → Secrets and variables → Actions → New repository secret**

- Name: `YOUTUBE_API_KEY`
- Value: your Google Cloud API key (YouTube Data API v3 enabled)

Optionally override the video with a repository **variable** named `VIDEO_ID`
(defaults to `MH0_mPt-VXE`).

### 3. Enable GitHub Pages

Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `/ (root)`.

Your dashboard will be live at `https://<you>.github.io/msy-live-dashboard/`.

### 4. (Recommended) Run it once manually

Repo → **Actions → Fetch live viewers → Run workflow**. This confirms the secret
works and writes the first data point.

## Local testing

```bash
export YOUTUBE_API_KEY="your-key-here"
python3 scripts/fetch_viewers.py
# preview the dashboard:
python3 -m http.server 8000   # then open http://localhost:8000
```

## Cost

Sampling every 5 minutes ≈ 8,640 runs/month.

| | Public repo | Private repo |
|---|---|---|
| Actions cost | **Free (unlimited)** | ~$53/mo |

## Known caveats

- **Cron is best-effort.** GitHub's minimum interval is 5 minutes and runs can be
  delayed or skipped under load. Expect roughly-5-minute granularity, not exact.
- **Scheduled workflows auto-disable after 60 days of repo inactivity.** Commits
  made by the default `GITHUB_TOKEN` may not reset this timer. If the job ever
  goes quiet, re-enable it in the Actions tab, or push commits with a Personal
  Access Token instead of `GITHUB_TOKEN`.
- **Git history grows** by one commit per run. The data itself is tiny
  (~few MB/year); history is the only thing that accumulates.
- `concurrentViewers` is only present while the stream is **live** and the owner
  has not hidden the count.

## Want 1-minute resolution?

GitHub cron can't go below 5 minutes, but you can have one 5-minute job sample
internally every 60s (`sleep 60` loop ×5) and commit all points at once. Ask and
this can be wired up.
