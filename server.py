#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import subprocess
import sys
from urllib.parse import urlparse

class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Serve the main page
        if parsed_path.path == '/' or parsed_path.path == '/index.html':
            self.path = '/index.html'
            return super().do_GET()
        
        # Serve game data files
        elif parsed_path.path.startswith('/web_data/'):
            return super().do_GET()
        
        # Serve static files
        elif parsed_path.path.endswith(('.js', '.css', '.html')):
            return super().do_GET()
        
        # 404 for everything else
        else:
            self.send_error(404)

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        # Handle game regeneration
        if parsed_path.path == '/regenerate_game.py':
            try:
                # Run the prepare_web_data script to generate new game
                result = subprocess.run([sys.executable, 'prepare_web_data.py'], 
                                      capture_output=True, text=True)
                
                if result.returncode == 0:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"status": "success"}')
                else:
                    self.send_error(500)
            except Exception as e:
                print(f"Error regenerating game: {e}")
                self.send_error(500)
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        # Suppress default logging for cleaner output
        pass

def start_server(port=8000):
    """Start the development server"""
    
    # Generate initial game data if it doesn't exist
    if not os.path.exists('web_data'):
        print("Generating initial game data...")
        try:
            subprocess.run([sys.executable, 'prepare_web_data.py'], check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error generating game data: {e}")
            print("Make sure you have run find_valid_pairs.py first!")
            return
    
    with socketserver.TCPServer(("", port), GameHandler) as httpd:
        print(f"🏒 Liney Link server running at http://localhost:{port}")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Start Liney Link development server')
    parser.add_argument('--port', type=int, default=8000, help='Port to run server on (default: 8000)')
    
    args = parser.parse_args()
    start_server(args.port)