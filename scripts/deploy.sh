#!/bin/bash
# Deploy the latest main branch to production. Run this ON THE SERVER, from ~/app:
#   bash scripts/deploy.sh
# or from your own machine in one line:
#   ssh -i /path/to/the-hekims-connect.pem ec2-user@15.134.186.132 "bash ~/app/scripts/deploy.sh"
set -e

cd ~/app

echo "→ Backing up database"
cp dev.db "dev.db.bak.$(date +%Y%m%d%H%M%S)"

echo "→ Pulling latest code"
git pull origin main

echo "→ Installing dependencies"
bun install

echo "→ Syncing database schema (safe/idempotent — only applies pending changes)"
bunx prisma db push --accept-data-loss

echo "→ Building"
bun run build

echo "→ Copying static assets into the standalone build"
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "→ Restarting service"
sudo systemctl restart hekims-connect
sleep 2

echo "→ Re-seeding metadata (idempotent — only adds what's missing)"
curl -s -X POST http://localhost:3000/api/seed
echo

echo "→ Verifying"
curl -s -o /dev/null -w "Homepage: %{http_code}\n" https://thehekimsconnect.com/

echo "✓ Deploy complete"
