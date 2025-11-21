# Player Data Management

The `players/` and `player_linkages/` folders contain large amounts of data (~100MB+) that cannot be committed to the repository. This document explains how the data is managed for both local development and GitHub Actions.

## The Problem

- **players/** folder: ~2,700 JSON files with player information
- **player_linkages/** folder: ~2,700 JSON files with pre-computed connections
- **Total size:** ~100-200MB (too large for git, slows down clones)

## The Solution

We use **GitHub Releases** to store the data as compressed archives, which are downloaded by GitHub Actions when needed.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub Repository                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Code (committed)                                  │  │
│  │  - Python scripts                                 │  │
│  │  - GitHub Actions workflows                       │  │
│  │  - Generated puzzles in docs/                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ GitHub Releases (data storage)                    │  │
│  │  - players.tar.gz (~20MB)                         │  │
│  │  - player_linkages.tar.gz (~30MB)                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           ↓                              ↓
    Daily Puzzle                  Manual/Monthly
    Workflow                      Data Update
```

## How It Works

### 1. Data Generation (Monthly/As Needed)

The **Update Player Data** workflow (`.github/workflows/update-player-data.yml`) runs monthly or manually to:

1. Fetch latest player data from NHL API
2. Fetch shift chart data from NHL API
3. Compute player linkages
4. Create compressed archives
5. Upload to GitHub Releases with tag "latest"

**Trigger manually:**
```bash
# Via GitHub UI: Actions → Update Player Data Cache → Run workflow
# Or via CLI:
gh workflow run update-player-data.yml
```

### 2. Puzzle Generation (Daily)

The **Update Daily Puzzles** workflow (`.github/workflows/update-puzzles.yml`) runs daily to:

1. Download `players.tar.gz` and `player_linkages.tar.gz` from latest release
2. Extract the archives
3. Generate new daily puzzles
4. Commit puzzles to `docs/puzzles/`

**This runs automatically at 2 AM UTC daily.**

## Local Development

### Option 1: Download from GitHub Release (Recommended)

```bash
# Download latest data archives
gh release download latest --pattern "*.tar.gz"

# Extract
tar -xzf players.tar.gz
tar -xzf player_linkages.tar.gz

# Clean up
rm *.tar.gz
```

### Option 2: Generate from Scratch

```bash
# Fetch player data from NHL API
python3 pull_players.py

# Fetch shift charts from NHL API (slow - may take hours)
python3 pull_shifts.py

# Compute player linkages (also slow)
python3 player_linkages.py
```

### Option 3: Use the Helper Script

```bash
# One-time download and setup
./scripts/setup_data.sh
```

## Creating a New Data Release

### Manual Method

```bash
# After generating/updating data locally
./create_data_release.sh v1.0.0
```

### Automatic Method

Just trigger the Update Player Data workflow:
```bash
gh workflow run update-player-data.yml
```

## When to Update Player Data

Update the player data when:

- ✅ **Start of NHL season** - New players, new teams
- ✅ **Mid-season** - If you want recent trades/callups
- ✅ **After bug fixes** - If you fixed data processing logic
- ✅ **Adding historical data** - If adding older seasons

**You DON'T need to update for:**
- ❌ Changing puzzle generation logic (uses existing data)
- ❌ UI changes
- ❌ Documentation updates

## .gitignore Configuration

These folders are excluded from git:

```gitignore
# Large data folders (stored in GitHub Releases)
players/
player_linkages/
shift_charts/

# Data archives
*.tar.gz
*.zip
```

## Troubleshooting

### "No release found" error in workflow

**Problem:** The daily puzzle workflow can't find the data release.

**Solution:** Run the data update workflow to create a release:
```bash
gh workflow run update-player-data.yml
```

### Data is outdated

**Problem:** Player data is from last season.

**Solution:** Manually trigger data update or wait for monthly automatic update.

### Local data is corrupted

**Problem:** Extraction errors or incomplete data.

**Solution:**
```bash
# Clean up
rm -rf players/ player_linkages/

# Re-download
gh release download latest --pattern "*.tar.gz"
tar -xzf players.tar.gz
tar -xzf player_linkages.tar.gz
```

### Release is too large

**Problem:** GitHub has 2GB limit per file, 10GB per release.

**Current sizes:**
- players.tar.gz: ~20MB ✅
- player_linkages.tar.gz: ~30MB ✅
- **Total: ~50MB** (well under limits)

If sizes grow significantly:
- Consider using Git LFS
- Or split by season
- Or use external storage (S3, etc.)

## File Structure

```
liney-link/
├── players/                     # ← Downloaded from release
│   ├── 8471214.json
│   ├── 8471233.json
│   └── ... (2,700+ files)
│
├── player_linkages/             # ← Downloaded from release
│   ├── 8471214.json
│   ├── 8471233.json
│   ├── summary.json
│   └── ... (2,700+ files)
│
├── shift_charts/                # ← Optional, for regenerating linkages
│   ├── 20122013/
│   ├── 20132014/
│   └── ...
│
├── docs/                        # ← Committed to git
│   ├── puzzles/
│   │   ├── 2025-11-20-easy.json
│   │   ├── 2025-11-20-hard.json
│   │   └── ...
│   └── puzzle_index.json
│
└── .github/workflows/
    ├── update-puzzles.yml       # Daily: Download data → Generate puzzles
    └── update-player-data.yml   # Monthly: Refresh data in releases
```

## Alternative Solutions Considered

### ❌ Git LFS
- **Pros:** Designed for large files
- **Cons:** Requires LFS quota, adds complexity, costs money

### ❌ Commit to repository
- **Pros:** Simple
- **Cons:** Makes repo huge (100MB+), slow clones, exceeds recommended limits

### ❌ External storage (S3, etc.)
- **Pros:** Unlimited size
- **Cons:** Requires credentials, costs money, another service to manage

### ✅ GitHub Releases (Current Solution)
- **Pros:** Free, integrated, simple, reliable
- **Cons:** 2GB file limit (not an issue for us)

## Monitoring

Check release status:
```bash
# List all releases
gh release list

# View latest release
gh release view latest

# Check file sizes
gh release view latest --json assets --jq '.assets[] | "\(.name): \(.size / 1024 / 1024 | round)MB"'
```

## Cost

**Everything is free!**
- GitHub Releases: Free (up to 2GB per file, 10GB per release)
- GitHub Actions: Free tier includes 2,000 minutes/month
- Storage: Included in GitHub free tier

Our usage:
- Data update: ~10 minutes/month
- Puzzle generation: ~2 minutes/day × 30 = 60 minutes/month
- **Total: ~70 minutes/month** (3.5% of free tier)

---

**Questions?** Check the workflows or open an issue.
