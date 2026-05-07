import http.server
import socketserver
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class UTF8Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        t = super().guess_type(path)
        return t

PORT = 8765

with socketserver.TCPServer(("", PORT), UTF8Handler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
