#!/bin/bash
#
# Quick setup script to download player data for local development
#
# Usage: ./setup_data.sh
#

set -e

echo "🎯 Liney Link - Player Data Setup"
echo "=================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo ""
    echo "Install it first:"
    echo "  macOS:   brew install gh"
    echo "  Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: https://github.com/cli/cli/releases"
    echo ""
    exit 1
fi

# Check if already authenticated
if ! gh auth status &> /dev/null; then
    echo "🔐 GitHub authentication required"
    gh auth login
fi

echo "📥 Downloading player data from latest release..."
echo ""

# Download from latest release
if gh release download latest --pattern "*.tar.gz" 2>/dev/null; then
    echo ""
    echo "✅ Downloaded successfully"
else
    echo ""
    echo "⚠️  No release found with name 'latest'"
    echo ""
    echo "Options:"
    echo "1. Run the data update workflow to create a release:"
    echo "   gh workflow run update-player-data.yml"
    echo ""
    echo "2. Generate data locally (slow - may take hours):"
    echo "   python3 pull_players.py"
    echo "   python3 pull_shifts.py"
    echo "   python3 player_linkages.py"
    echo ""
    exit 1
fi

# Extract archives
if [ -f "players.tar.gz" ]; then
    echo ""
    echo "📦 Extracting players.tar.gz..."
    tar -xzf players.tar.gz
    PLAYER_COUNT=$(find players -name "*.json" 2>/dev/null | wc -l)
    echo "   ✅ Extracted $PLAYER_COUNT player files"
    rm players.tar.gz
fi

if [ -f "player_linkages.tar.gz" ]; then
    echo ""
    echo "📦 Extracting player_linkages.tar.gz..."
    tar -xzf player_linkages.tar.gz
    LINKAGE_COUNT=$(find player_linkages -name "*.json" -not -name "summary.json" 2>/dev/null | wc -l)
    echo "   ✅ Extracted $LINKAGE_COUNT linkage files"
    rm player_linkages.tar.gz
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "You can now:"
echo "  • Generate puzzles: python3 generate_game.py"
echo "  • Find pairs: python3 find_valid_pairs.py"
echo "  • Create monthly puzzles: python3 generate_monthly_puzzles.py"
echo ""
