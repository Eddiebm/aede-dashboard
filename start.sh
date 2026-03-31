#!/usr/bin/env bash
# AEDE Dashboard — One-Command Local Setup & Start
# Usage: bash start.sh

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   AEDE Dashboard — Local Setup & Start   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Install pnpm if missing ──────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "→ Installing pnpm..."
  curl -fsSL https://get.pnpm.io/install.sh | sh - 2>/dev/null

  # Activate pnpm in this shell session
  export PNPM_HOME="$HOME/.local/share/pnpm"
  [ "$(uname)" = "Darwin" ] && export PNPM_HOME="$HOME/Library/pnpm"
  export PATH="$PNPM_HOME:$PATH"

  if ! command -v pnpm &>/dev/null; then
    echo "✗ pnpm install failed. Trying npm fallback..."
    # Add pnpm as a local binary via npm
    npm install -g pnpm --prefix "$HOME/.npm-global" 2>/dev/null || true
    export PATH="$HOME/.npm-global/bin:$PATH"
  fi
else
  echo "✓ pnpm found: $(pnpm --version)"
fi

# ── 2. Install dependencies ──────────────────────────────────────────────────
echo "→ Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── 3. Create .env if missing ────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "→ Creating .env file..."
  cat > .env << 'ENVEOF'
# AEDE Dashboard — Local Environment
# Update DATABASE_URL with your local MySQL credentials

DATABASE_URL=mysql://root:@localhost:3306/aede_dashboard
JWT_SECRET=aede-local-secret-key-change-in-production-32chars

# Optional: Manus OAuth (leave blank for local dev without auth)
VITE_APP_ID=local
OAUTH_SERVER_URL=http://localhost:3000
VITE_OAUTH_PORTAL_URL=http://localhost:3000
OWNER_OPEN_ID=local-owner
OWNER_NAME=Owner
ENVEOF
  echo "✓ .env created — edit DATABASE_URL if your MySQL has a password"
else
  echo "✓ .env already exists"
fi

# ── 4. Create MySQL database ─────────────────────────────────────────────────
echo "→ Creating database (if not exists)..."
DB_NAME="aede_dashboard"

# Try to extract user/password from DATABASE_URL
DB_URL="${DATABASE_URL:-mysql://root:@localhost:3306/aede_dashboard}"
DB_USER=$(echo "$DB_URL" | sed -E 's|mysql://([^:@]+).*|\1|')
DB_PASS=$(echo "$DB_URL" | sed -E 's|mysql://[^:]+:([^@]*)@.*|\1|')
DB_HOST=$(echo "$DB_URL" | sed -E 's|mysql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')

if command -v mysql &>/dev/null; then
  if [ -z "$DB_PASS" ]; then
    mysql -u "$DB_USER" -h "$DB_HOST" -P "$DB_PORT" \
      -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" 2>/dev/null && \
      echo "✓ Database '$DB_NAME' ready" || \
      echo "⚠ Could not create database — you may need to create it manually"
  else
    mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" \
      -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" 2>/dev/null && \
      echo "✓ Database '$DB_NAME' ready" || \
      echo "⚠ Could not create database — you may need to create it manually"
  fi
else
  echo "⚠ mysql CLI not found — skipping database creation"
  echo "  Please create the database manually: CREATE DATABASE aede_dashboard;"
fi

# ── 5. Push schema ────────────────────────────────────────────────────────────
echo "→ Pushing database schema..."
pnpm db:push 2>&1 | tail -5 || echo "⚠ Schema push failed — check your DATABASE_URL in .env"

# ── 6. Seed brands ────────────────────────────────────────────────────────────
echo "→ Seeding 12 brands..."
node scripts/seed-brands.mjs 2>&1 | tail -5 || echo "⚠ Seed failed — brands may already exist"

# ── 7. Start the server ───────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Starting AEDE Dashboard on port 3000    ║"
echo "║  Open: http://localhost:3000             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

pnpm dev
