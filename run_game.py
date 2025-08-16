#!/usr/bin/env python3
"""
Development script to easily run the Liney Link game.
Automatically regenerates game data and starts the server.
"""

import subprocess
import sys
import os
import webbrowser
import time

def main():
    print("🏒 Starting Liney Link Game...")
    
    # Step 1: Generate game data
    print("1. Generating fresh game data...")
    try:
        result = subprocess.run([sys.executable, 'prepare_web_data.py'], check=True)
        print("   ✓ Game data generated successfully!")
    except subprocess.CalledProcessError as e:
        print(f"   ❌ Failed to generate game data: {e}")
        print("   Make sure you have run find_valid_pairs.py first!")
        return 1
    
    # Step 2: Start server
    print("2. Starting development server...")
    port = 8080
    
    try:
        # Start server in background
        server_process = subprocess.Popen([
            sys.executable, 'server.py', '--port', str(port)
        ])
        
        # Give server time to start
        time.sleep(2)
        
        # Open browser
        url = f"http://localhost:{port}"
        print(f"3. Opening game at {url}")
        webbrowser.open(url)
        
        print("\n🎮 Game is ready! Instructions:")
        print("   • Search for hockey players in the search box")
        print("   • Add players that connect to either target player")
        print("   • Complete the chain to win!")
        print("   • Refresh the page for a new puzzle")
        print("\n   Press Ctrl+C to stop the server")
        
        # Wait for server to finish
        server_process.wait()
        
    except KeyboardInterrupt:
        print("\n\n👋 Stopping server...")
        server_process.terminate()
        server_process.wait()
        print("   Server stopped. Thanks for playing!")
        return 0
    except Exception as e:
        print(f"   ❌ Error starting server: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())