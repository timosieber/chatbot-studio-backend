#!/bin/sh

echo "=== Custom start script executing ==="
echo "=== Current directory: $(pwd) ==="
echo "=== Listing dist directory: ==="
ls -la dist/ || echo "dist directory not found!"

echo "=== Running Prisma migrations ==="
# Mark the failed migration as rolled back, then reapply it
echo "Checking for failed migrations..."
npx prisma migrate resolve --rolled-back 20251120_add_enums || echo "No failed migration found"

# Now run migrations (will apply the fixed migration)
npx prisma migrate deploy

echo "=== Migrations complete! ==="
echo "=== Starting Node.js application ==="
exec node dist/index.js
