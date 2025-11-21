# GitHub Actions Workflow - Quick Start Guide

## The Problem We Solved

The `players/` and `player_linkages/` folders are too large (~100MB) to commit to git, but the workflows need them to generate puzzles.

**Solution:** Store the data in GitHub Releases and download it when needed.

---

## First-Time Setup (ONE TIME ONLY)

You **must** create an initial data release before the daily puzzle workflow can run.

### Step 1: Ensure requirements.txt is correct

✅ Already done! The file now includes:
```
requests>=2.31.0
```

### Step 2: Create the initial data release

**Option A: Use GitHub Actions (Recommended)**

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click **Update Player Data Cache** workflow
4. Click **Run workflow** button
5. Wait ~10-20 minutes for it to complete

**Option B: Create Manually (If you have data locally)**

```bash
# Make sure you have the data folders
ls players/ player_linkages/

# Create the release
./create_data_release.sh v1.0.0
```

### Step 3: Verify the release was created

```bash
gh release list
# Should show a release with tag like "data-2025-11-21"

gh release view latest
# Should show players.tar.gz and player_linkages.tar.gz
```

---

## Daily Usage (Automatic)

Once the initial release exists, everything runs automatically!

### Daily Puzzle Workflow

- **What:** Generates new daily puzzles
- **When:** Runs at 2 AM UTC every day
- **Does:**
  1. Downloads player data from latest release
  2. Generates new puzzles for next 30 days
  3. Commits puzzles to `docs/puzzles/`

**Manual trigger:**
```bash
gh workflow run update-puzzles.yml
```

### Monthly Data Refresh

- **What:** Updates player data from NHL API
- **When:** Runs on 1st of each month at 3 AM UTC
- **Does:**
  1. Fetches latest NHL player data
  2. Computes player linkages
  3. Creates new release with updated data

**Manual trigger (recommended at start of season):**
```bash
gh workflow run update-player-data.yml
```

---

## Local Development

### First-Time Setup

```bash
# Quick setup (downloads from release)
./setup_data.sh

# Or manually
gh release download latest --pattern "*.tar.gz"
tar -xzf players.tar.gz
tar -xzf player_linkages.tar.gz
rm *.tar.gz
```

### Generate Puzzles Locally

```bash
# Single game
python3 generate_game.py

# Monthly puzzles
python3 generate_monthly_puzzles.py
```

---

## Troubleshooting

### ❌ Error: "No module named 'requests'"

**Cause:** Dependencies not installed

**Fix:**
```bash
pip install -r requirements.txt
```

Or in the workflow, ensure this step exists:
```yaml
- name: Install dependencies
  run: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt
```

### ❌ Error: "No release found"

**Cause:** Initial data release hasn't been created

**Fix:** Run the Update Player Data workflow once:
```bash
gh workflow run update-player-data.yml
```

Then wait for it to complete and retry.

### ❌ Error: "No players.tar.gz in release"

**Cause:** The release exists but doesn't contain the data files

**Fix:** Re-run the data update workflow:
```bash
gh workflow run update-player-data.yml
```

### ❌ Puzzles are using old player data

**Cause:** Data release is outdated

**Fix:** Manually trigger data refresh:
```bash
gh workflow run update-player-data.yml
```

---

## File Overview

### Workflows

| File | Purpose | Trigger |
|------|---------|---------|
| `update-player-data.yml` | Create/update data release | Monthly + Manual |
| `update-puzzles.yml` | Generate daily puzzles | Daily + Manual |

### Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `setup_data.sh` | Download data for local dev | `./setup_data.sh` |
| `create_data_release.sh` | Create release manually | `./create_data_release.sh v1.0` |
| `pull_players.py` | Fetch player data from NHL | Part of data workflow |
| `pull_shifts.py` | Fetch shift data from NHL | Part of data workflow |
| `player_linkages.py` | Compute player connections | Part of data workflow |
| `generate_monthly_puzzles.py` | Generate puzzles | Part of daily workflow |

---

## Checklist for New Repository

- [ ] 1. Clone repository
- [ ] 2. Verify `requirements.txt` includes `requests>=2.31.0`
- [ ] 3. Run "Update Player Data Cache" workflow (first time)
- [ ] 4. Wait for workflow to complete (~10-20 minutes)
- [ ] 5. Verify release created: `gh release view latest`
- [ ] 6. Test daily workflow: `gh workflow run update-puzzles.yml`
- [ ] 7. Enable GitHub Pages (if not already enabled)
- [ ] 8. Done! Workflows run automatically from now on

---

## When to Update Data

### ✅ Update when:

- Start of NHL season (new players, teams)
- Mid-season (if you want recent trades)
- After fixing data processing bugs
- Adding historical seasons

### ❌ Don't update for:

- UI changes
- Documentation updates
- Puzzle generation logic changes (uses existing data)

---

## Costs

**Everything is FREE!**

- GitHub Actions: 2,000 minutes/month (we use ~70)
- GitHub Releases: 2GB per file, 10GB per release (we use ~50MB)
- Total monthly cost: **$0.00**

---

## Quick Commands

```bash
# Check workflows
gh workflow list

# View workflow runs
gh run list

# View latest run details
gh run view

# Manually trigger data update
gh workflow run update-player-data.yml

# Manually trigger puzzle generation
gh workflow run update-puzzles.yml

# Check releases
gh release list

# Download data locally
gh release download latest --pattern "*.tar.gz"

# View requirements
cat requirements.txt
```

---

## Summary

1. **One-time setup:** Create initial data release
2. **Automatic operation:** Workflows run on schedule
3. **Manual triggers:** Available when needed
4. **Local development:** Simple setup with `setup_data.sh`
5. **No costs:** Everything uses GitHub free tier

**Questions?** See [DATA_MANAGEMENT.md](DATA_MANAGEMENT.md) for detailed docs.
