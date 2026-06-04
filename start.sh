#!/bin/bash

echo ""
echo "  =========================================="
echo "    VidNova Server - Starting..."
echo "  =========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ERROR: Node.js not found!"
  echo "  Install from: https://nodejs.org"
  exit 1
fi

# Install if needed
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
  echo "  Done!"
  echo ""
fi

echo "  Server → http://localhost:3000"
echo "  Admin  → http://localhost:3000/admin.html"
echo "  Login: chintan@vidnova / upload@2410"
echo ""
echo "  Press Ctrl+C to stop"
echo ""

# Open browser (Mac)
sleep 2 && open "http://localhost:3000" &> /dev/null &

node server.js
