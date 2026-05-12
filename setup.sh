#!/usr/bin/env bash
# CrypTalk Setup Script
# Run: chmod +x setup.sh && ./setup.sh

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
RESET='\033[0m'

echo ""
echo -e "${PURPLE}╔═══════════════════════════════════════════╗${RESET}"
echo -e "${PURPLE}║        🔐  CrypTalk Setup                 ║${RESET}"
echo -e "${PURPLE}║  End-to-End Encrypted Messaging           ║${RESET}"
echo -e "${PURPLE}╚═══════════════════════════════════════════╝${RESET}"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VER=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found v$NODE_VER)"
  exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) found${RESET}"

# Install backend deps
echo ""
echo -e "${BLUE}Installing backend dependencies...${RESET}"
cd backend
npm install --silent
echo -e "${GREEN}✓ Dependencies installed${RESET}"

# Generate .env if not exists
if [ ! -f .env ]; then
  echo ""
  echo -e "${BLUE}Generating .env with secure JWT secret...${RESET}"
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
  cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
PORT=3001
EOF
  echo -e "${GREEN}✓ .env created with secure random JWT_SECRET${RESET}"
else
  echo -e "${CYAN}ℹ .env already exists — skipping${RESET}"
fi

cd ..

echo ""
echo -e "${PURPLE}════════════════════════════════════════════${RESET}"
echo -e "${BOLD}Setup complete! To start CrypTalk:${RESET}"
echo ""
echo -e "  ${CYAN}1. Start the backend server:${RESET}"
echo -e "     cd backend && npm start"
echo ""
echo -e "  ${CYAN}2. Serve the frontend (in another terminal):${RESET}"
echo -e "     python3 -m http.server 8080 --directory frontend"
echo -e "     ${BLUE}# or: npx http-server frontend -p 8080${RESET}"
echo ""
echo -e "  ${CYAN}3. Open in browser:${RESET}"
echo -e "     http://localhost:8080"
echo ""
echo -e "${PURPLE}════════════════════════════════════════════${RESET}"
echo -e "  🔐 All messages encrypted with AES-256-GCM"
echo -e "  🔑 ECDH P-256 key exchange"
echo -e "  📦 Encrypted blobs stored in backend/data/"
echo -e "${PURPLE}════════════════════════════════════════════${RESET}"
echo ""
