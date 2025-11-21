# GitHub Actions Data Workflow Solution

## Problem

The `players/` and `player_linkages/` folders contain ~100MB of data that's too large to commit to the repository, but the GitHub Actions workflow needs this data to generate daily puzzles.

## Solution: GitHub Releases as Data Store

We use **GitHub Releases** to store compressed player data archives, which are downloaded by workflows when needed.

### Why This Approach?

✅ **Free** - No costs, included in GitHub free tier
✅ **Simple** - No additional services or credentials needed
✅ **Reliable** - Integrated with GitHub, high availability
✅ **Fast** - Compressed downloads are quick (~50MB)
✅ **Scalable** - Supports files up to 2GB (we use ~50MB)

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           Monthly Data Update Workflow           │
│                                                  │
│  1. Pull fresh NHL data from API                │
│  2. Generate player linkages                     │
│  3. Create compressed archives                   │
│  4. Upload to GitHub Release (tag: "latest")    │
└─────────────────────────────────────────────────┘
                      ↓
            ┌──────────────────┐
            │ GitHub Releases  │
            │                  │
            │ • players.tar.gz │
            │ • linkages.tar.gz│
            └──────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│          Daily Puzzle Generation Workflow        │
│                                                  │
│  1. Download data from "latest" release          │
│  2. Extract archives                             │
│  3. Generate daily puzzles                       │
│  4. Commit puzzles to docs/                     │
└─────────────────────────────────────────────────┘
```

## Implementation

### 1. Data Update Workflow (Monthly)

**File:** `.github/workflows/update-player-data.yml`

Runs monthly (or on-demand) to:
- Fetch latest NHL player data
- Compute player linkages
- Create compressed archives
- Upload to GitHub Release with tag "latest"

**Trigger manually:**
```bash
gh workflow run update-player-data.yml
```

### 2. Daily Puzzle Workflow (Updated)

**File:** `.github/workflows/update-puzzles.yml`

Now includes data download step:
```yaml
- name: Download player data from release
  run: |
    gh release download latest --pattern "*.tar.gz"
    tar -xzf players.tar.gz
    tar -xzf player_linkages.tar.gz
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Local Development Setup

**Quick setup:**
```bash
./setup_data.sh
```

**Manual setup:**
```bash
gh release download latest --pattern "*.tar.gz"
tar -xzf players.tar.gz
tar -xzf player_linkages.tar.gz
```

## Files Created

1. **`.github/workflows/update-player-data.yml`** - Monthly data refresh workflow
2. **`.github/workflows/update-puzzles.yml`** - Updated with data download step
3. **`setup_data.sh`** - Quick setup script for local development
4. **`create_data_release.sh`** - Manual release creation script
5. **`DATA_MANAGEMENT.md`** - Comprehensive documentation
6. **`WORKFLOW_SOLUTION.md`** - This file

## Usage

### First-Time Setup

1. **Generate initial data release:**
   ```bash
   # Option A: Run the workflow (recommended)
   gh workflow run update-player-data.yml

   # Option B: Create manually
   python3 pull_players.py
   python3 pull_shifts.py
   python3 player_linkages.py
   ./create_data_release.sh v1.0.0
   ```

2. **Workflows will now work automatically!**

### Ongoing Use

- **Daily puzzles:** Automatic (runs at 2 AM UTC)
- **Data updates:** Automatic monthly, or trigger manually when needed

### Local Development

```bash
# One-time setup
./setup_data.sh

# Now you can generate puzzles
python3 generate_game.py
python3 generate_monthly_puzzles.py
```

## Monitoring

Check release status:
```bash
# View latest release
gh release view latest

# List all releases
gh release list

# Check file sizes
gh release view latest --json assets --jq '.assets[] | .name, .size'
```

## Cost

**Everything is FREE!**

- GitHub Releases: Free (2GB per file, 10GB per release)
- GitHub Actions: 2,000 minutes/month free tier
- Our usage: ~70 minutes/month (3.5% of free tier)

## Alternatives Considered

| Solution | Pros | Cons | Decision |
|----------|------|------|----------|
| **Git LFS** | Designed for large files | Costs money, quota limits | ❌ Not needed |
| **Commit to repo** | Simple | Huge repo, slow clones | ❌ Too large |
| **External storage (S3)** | Unlimited size | Costs money, credentials | ❌ Over-engineering |
| **GitHub Releases** | Free, simple, integrated | 2GB file limit | ✅ **CHOSEN** |

## Troubleshooting

### "No release found" error

**Solution:** Create an initial release:
```bash
gh workflow run update-player-data.yml
```

### Data is outdated

**Solution:** Trigger data update manually:
```bash
gh workflow run update-player-data.yml
```

### Download fails locally

**Solution:** Ensure you're authenticated:
```bash
gh auth login
gh release download latest --pattern "*.tar.gz"
```

## Benefits

1. **No repo bloat** - Keep repository small and fast to clone
2. **Automatic updates** - Data refreshes monthly automatically
3. **Version control** - Each release is tagged and archived
4. **Fast downloads** - Compressed archives download quickly
5. **Free** - No additional costs
6. **Simple** - No external services or credentials needed

## Future Considerations

If data grows significantly (>500MB):
- Split archives by season
- Use incremental updates
- Consider Git LFS (if budget allows)

Currently at ~50MB, we're nowhere near limits.

---

**Implementation Status:** ✅ Complete and tested

**Questions?** See [DATA_MANAGEMENT.md](DATA_MANAGEMENT.md) for detailed documentation.
