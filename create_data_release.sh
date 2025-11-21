#!/bin/bash
#
# Create a GitHub release with player data archives
# This allows the GitHub Actions workflow to download the data
#
# Usage: ./create_data_release.sh [version]
#
# Example: ./create_data_release.sh v1.0.0
#

set -e

VERSION=${1:-"latest"}
RELEASE_NAME="Player Data - $(date +'%Y-%m-%d')"
RELEASE_TAG="data-${VERSION}"

echo "🎯 Creating data release: ${RELEASE_TAG}"
echo "================================"

# Check if folders exist
if [ ! -d "players" ]; then
    echo "❌ Error: players/ folder not found"
    echo "   Run: python3 pull_players.py"
    exit 1
fi

if [ ! -d "player_linkages" ]; then
    echo "❌ Error: player_linkages/ folder not found"
    echo "   Run: python3 pull_shifts.py && python3 player_linkages.py"
    exit 1
fi

# Create archives
echo "📦 Creating players.tar.gz..."
tar -czf players.tar.gz players/
PLAYERS_SIZE=$(du -h players.tar.gz | cut -f1)
echo "   Size: ${PLAYERS_SIZE}"

echo "📦 Creating player_linkages.tar.gz..."
tar -czf player_linkages.tar.gz player_linkages/
LINKAGES_SIZE=$(du -h player_linkages.tar.gz | cut -f1)
echo "   Size: ${LINKAGES_SIZE}"

echo ""
echo "📊 Archive Summary:"
echo "   players.tar.gz: ${PLAYERS_SIZE}"
echo "   player_linkages.tar.gz: ${LINKAGES_SIZE}"
echo ""

# Create release notes
cat > release_notes.md <<EOF
# Player Data Release

This release contains pre-computed player data for Liney Link puzzle generation.

## Contents

- **players.tar.gz** (${PLAYERS_SIZE}) - Player information from NHL API
- **player_linkages.tar.gz** (${LINKAGES_SIZE}) - Pre-computed player connections

## Usage

This data is automatically downloaded by the GitHub Actions workflow when generating daily puzzles.

To use locally:
\`\`\`bash
# Download from latest release
gh release download latest --pattern "*.tar.gz"

# Extract
tar -xzf players.tar.gz
tar -xzf player_linkages.tar.gz
\`\`\`

## Data Details

- **Players:** $(find players -name "*.json" | wc -l) NHL players
- **Linkages:** $(find player_linkages -name "*.json" -not -name "summary.json" | wc -l) players with computed connections
- **Generated:** $(date +'%Y-%m-%d %H:%M:%S %Z')
- **Seasons:** 2012-2013 through $(date +'%Y')

## Freshness

This data should be refreshed:
- At the start of each NHL season
- When adding new historical data
- When fixing data processing bugs

---
Generated automatically for Liney Link puzzle generation.
EOF

echo "📝 Release notes created"
echo ""

# Check if release exists and delete it
if gh release view "${RELEASE_TAG}" >/dev/null 2>&1; then
    echo "🗑️  Deleting existing release ${RELEASE_TAG}..."
    gh release delete "${RELEASE_TAG}" --yes
fi

# Create the release
echo "🚀 Creating GitHub release..."
gh release create "${RELEASE_TAG}" \
    --title "${RELEASE_NAME}" \
    --notes-file release_notes.md \
    players.tar.gz \
    player_linkages.tar.gz

echo ""
echo "✅ Release created successfully!"
echo ""
echo "🔗 View at: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/${RELEASE_TAG}"
echo ""
echo "📥 Download with:"
echo "   gh release download ${RELEASE_TAG} --pattern \"*.tar.gz\""
echo ""

# Cleanup
rm release_notes.md
rm players.tar.gz
rm player_linkages.tar.gz

echo "🧹 Cleaned up temporary files"
echo ""
echo "✨ Done!"
