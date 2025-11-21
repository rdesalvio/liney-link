# Liney Link 🏒

A daily hockey puzzle game where you connect players through their linemates.

## 🎮 How to Play

Connect two NHL players through a chain of linemates. Players are considered linemates if they:
- Played 600+ minutes together at any strength
- Play the same position (forwards with forwards, defensemen with defensemen)

## 🚀 GitHub Pages Deployment

This game is set up for easy deployment on GitHub Pages with pre-generated puzzles.

### Quick Setup

1. **Clone Repository**
   ```bash
   git clone <your-repo-url>
   cd liney-link
   ```

2. **Download Player Data** (required for puzzle generation)
   ```bash
   # Quick setup - downloads data from GitHub releases
   ./setup_data.sh

   # Or manually:
   gh release download latest --pattern "*.tar.gz"
   tar -xzf players.tar.gz
   tar -xzf player_linkages.tar.gz
   ```

   > **Note:** The `players/` and `player_linkages/` folders (~100MB) are stored in GitHub Releases, not in the repository. See [DATA_MANAGEMENT.md](DATA_MANAGEMENT.md) for details.

3. **Generate Puzzles**
   ```bash
   python3 generate_monthly_puzzles.py
   ```

4. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial setup with generated puzzles"
   git push origin main
   ```

5. **Enable GitHub Pages**
   - Go to your repository settings
   - Navigate to "Pages" section
   - Set source to "Deploy from a branch"
   - Select "main" branch and "/docs" folder
   - Save settings

6. **Your site will be available at:**
   `https://yourusername.github.io/repository-name`

### Automatic Updates

The included GitHub Action automatically:
- Generates new puzzles daily at 2 AM UTC
- Commits them to the repository
- Keeps your game updated with fresh content

### Local Development

Test locally using the included server:
```bash
cd docs
python3 serve.py
```
Visit `http://localhost:8080`

## 📁 Project Structure

```
liney-link/
├── docs/                   # GitHub Pages deployment files
│   ├── index.html         # Main game interface
│   ├── game.js           # Game logic
│   ├── puzzles/          # Pre-generated daily puzzles
│   ├── web_data/         # Player and connection data
│   └── serve.py          # Local development server
├── .github/workflows/    # GitHub Actions
├── generate_monthly_puzzles.py  # Puzzle generation script
└── [other development files]
```

## 🔧 Development

### Prerequisites
- Python 3.11+
- NHL shift data (processed)

### Key Scripts
- `generate_monthly_puzzles.py` - Generates puzzles for static hosting
- `find_valid_pairs.py` - Finds optimal player pairs
- `prepare_web_data.py` - Processes game data

### Adding Features
1. Make changes to source files
2. Run `python3 generate_monthly_puzzles.py` to update docs/
3. Test with `cd docs && python3 serve.py`
4. Commit and push changes

## 📊 Game Data

The game uses NHL shift data to determine player connections. Players must have played 600+ minutes together to be considered linemates.

## 🎯 Daily Puzzles

Each day features a new puzzle with carefully selected player pairs that:
- Have multiple solution paths
- Provide interesting connections
- Maintain appropriate difficulty

---

Made with ❤️ for hockey fans everywhere!