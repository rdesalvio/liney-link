#!/usr/bin/env python3
"""
Generate puzzles for multiple days and prepare for GitHub Pages deployment.
This script creates a month's worth of puzzles so the site can run purely static.
"""

import json
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

# Import existing modules
from find_valid_pairs import find_interesting_pairs
import random

def generate_monthly_puzzles(days=60):
    """Generate puzzles for the specified number of days."""
    
    print(f"🎯 Generating {days} days of puzzles...")
    
    # Create docs directory for GitHub Pages
    docs_dir = Path("docs")
    docs_dir.mkdir(exist_ok=True)
    
    # Create puzzles subdirectory
    puzzles_dir = docs_dir / "puzzles"
    puzzles_dir.mkdir(exist_ok=True)
    
    # Copy static files to docs directory
    static_files = ["index.html", "game.js"]
    for file in static_files:
        if os.path.exists(file):
            shutil.copy2(file, docs_dir / file)
            print(f"✓ Copied {file}")
    
    # Copy web_data directory structure
    web_data_dir = docs_dir / "web_data"
    if os.path.exists("web_data"):
        if web_data_dir.exists():
            shutil.rmtree(web_data_dir)
        shutil.copytree("web_data", web_data_dir)
        print("✓ Copied web_data directory")
    
    # Get all interesting pairs first
    print("🔍 Finding interesting player pairs...")
    all_pairs = find_interesting_pairs(max_pairs=300)  # Increased since we're being more selective
    if not all_pairs:
        print("❌ No suitable pairs found!")
        return
    random.shuffle(all_pairs)  # Randomize order
    print(f"✓ Found {len(all_pairs)} interesting pairs")
    
    # Generate puzzles for each day
    start_date = datetime.now().date()
    puzzle_index = {}
    
    # Limit days to available pairs
    actual_days = min(days, len(all_pairs))
    print(f"📊 Generating {actual_days} days of puzzles...")
    
    for day_offset in range(actual_days):
        current_date = start_date + timedelta(days=day_offset)
        date_str = current_date.strftime("%Y-%m-%d")
        
        print(f"📅 Generating puzzle for {date_str}...")
        
        try:
            # Pick a pair for this day
            pair_info = all_pairs[day_offset]
            player_a, player_b = pair_info['player_a'], pair_info['player_b']
            
            # Create puzzle data
            puzzle_data = {
                "playerA": player_a,
                "playerB": player_b,
                "date": date_str
            }
            
            # Save individual puzzle file
            puzzle_file = puzzles_dir / f"{date_str}.json"
            with open(puzzle_file, 'w') as f:
                json.dump(puzzle_data, f)
            
            # Add to index
            puzzle_index[date_str] = {
                "playerA": player_a,
                "playerB": player_b
            }
            
            print(f"✓ Generated puzzle: {player_a} → {player_b}")
            
        except Exception as e:
            print(f"❌ Error generating puzzle for {date_str}: {e}")
            continue
    
    # Save puzzle index
    index_file = docs_dir / "puzzle_index.json"
    with open(index_file, 'w') as f:
        json.dump(puzzle_index, f, indent=2)
    
    print(f"✓ Generated {len(puzzle_index)} puzzles")
    print(f"✓ Saved puzzle index with {len(puzzle_index)} entries")
    
    # Update the game.js to use date-based puzzle loading
    update_game_js_for_static_hosting(docs_dir)
    
    # Create a simple server for local testing
    create_local_server(docs_dir)
    
    print("\n🎉 Setup complete!")
    print(f"📁 All files ready in 'docs/' directory")
    print("🌐 Ready for GitHub Pages deployment")
    print("\n📋 Next steps:")
    print("1. Create a new GitHub repository")
    print("2. Push this code to the repository")
    print("3. Enable GitHub Pages in repository settings")
    print("4. Set source to 'docs' folder")

def update_game_js_for_static_hosting(docs_dir):
    """Update game.js to load puzzles based on current date."""
    
    game_js_path = docs_dir / "game.js"
    
    if not game_js_path.exists():
        print("❌ game.js not found in docs directory")
        return
    
    # Read the current game.js
    with open(game_js_path, 'r') as f:
        content = f.read()
    
    # Replace the loadGameData method to use date-based loading
    old_load_method = '''    async loadGameData() {
        try {
            // Load all data files
            const [playersResponse, connectionsResponse, gameResponse] = await Promise.all([
                fetch('./web_data/players.json'),
                fetch('./web_data/connections.json'),
                fetch('./web_data/current_game.json')
            ]);

            const players = await playersResponse.json();
            const connections = await connectionsResponse.json();
            const gameData = await gameResponse.json();'''
    
    new_load_method = '''    async loadGameData() {
        try {
            // Get today's date for puzzle selection
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            
            // Load all data files
            const [playersResponse, connectionsResponse, gameResponse] = await Promise.all([
                fetch('./web_data/players.json'),
                fetch('./web_data/connections.json'),
                fetch(`./puzzles/${today}.json`).catch(() => {
                    // Fallback to a default puzzle if today's doesn't exist
                    console.warn(`No puzzle found for ${today}, using fallback`);
                    return fetch('./puzzles/2024-12-16.json'); // Use first available puzzle as fallback
                })
            ]);

            const players = await playersResponse.json();
            const connections = await connectionsResponse.json();
            const gameData = await gameResponse.json();'''
    
    # Replace the method
    content = content.replace(old_load_method, new_load_method)
    
    # Write back the updated content
    with open(game_js_path, 'w') as f:
        f.write(content)
    
    print("✓ Updated game.js for static hosting")

def create_local_server(docs_dir):
    """Create a simple local server script for testing."""
    
    server_script = docs_dir / "serve.py"
    
    server_content = '''#!/usr/bin/env python3
"""
Simple local server for testing GitHub Pages deployment locally.
Run: python3 serve.py
"""

import http.server
import socketserver
import os
import sys

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"🌐 Local server running at http://localhost:{PORT}")
        print("📁 Serving from docs/ directory")
        print("🔄 Press Ctrl+C to stop")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\\n👋 Server stopped")
            sys.exit(0)
'''
    
    with open(server_script, 'w') as f:
        f.write(server_content)
    
    # Make it executable
    os.chmod(server_script, 0o755)
    
    print("✓ Created local test server: docs/serve.py")

if __name__ == "__main__":
    generate_monthly_puzzles()