#!/usr/bin/env python3
"""
Simple local server for testing GitHub Pages deployment locally.
Run: python3 serve.py
"""

import http.server
import socketserver
import os
import sys

def find_free_port(start_port=8080):
    """Find a free port starting from start_port"""
    for port in range(start_port, start_port + 100):
        try:
            with socketserver.TCPServer(("", port), None) as test_server:
                return port
        except OSError:
            continue
    raise RuntimeError("No free ports found")

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        PORT = find_free_port(8080)
    except RuntimeError:
        print("❌ Could not find a free port")
        sys.exit(1)
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"🌐 Local server running at http://localhost:{PORT}")
        print("📁 Serving from docs/ directory")
        print("🔄 Press Ctrl+C to stop")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")
            sys.exit(0)
