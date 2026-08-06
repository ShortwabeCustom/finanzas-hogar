#!/bin/bash

# Test script to verify statements API

echo "🧪 Probando API de Estados de Cuenta..."
echo ""

# Get database URL
source .env.local 2>/dev/null || source .env 2>/dev/null

# Check database directly
echo "📊 Verificando datos en base de datos..."
psql "$DATABASE_URL" -t -c "
SELECT
  COUNT(*) as total_statements,
  (SELECT COUNT(*) FROM \"BankAccount\" WHERE scope = 'PERSONAL') as personal_accounts,
  (SELECT COUNT(*) FROM \"BankTransaction\") as total_transactions
;" 2>&1

echo ""
echo "✅ Chequeo de BD completado"
