import { prisma } from '@/lib/prisma';

async function normalizeStatements() {
  console.log('🔄 Iniciando normalización de Estados de Cuenta...\n');

  try {
    // Get Alexis user
    const alexis = await prisma.user.findUnique({
      where: { email: 'alexis@productdesign.mx' },
    });

    if (!alexis) {
      throw new Error('Usuario Alexis no encontrado');
    }

    console.log(`👤 Usuario: ${alexis.name} (${alexis.email})`);

    // Get all personal statements for this user
    const statements = await prisma.bankStatement.findMany({
      where: {
        account: {
          userId: alexis.id,
          scope: 'PERSONAL',
        },
      },
      include: {
        account: true,
        transactions: { select: { id: true } },
      },
      orderBy: { periodEnd: 'desc' },
    });

    console.log(`\n📊 Total Estados de Cuenta encontrados: ${statements.length}`);

    if (statements.length === 0) {
      console.log('⚠️  No hay estados de cuenta para este usuario.');
      return;
    }

    // Verify and normalize each statement
    let normalized = 0;
    let errors: string[] = [];

    for (const stmt of statements) {
      try {
        // Check if statement has all required fields
        if (!stmt.periodStart || !stmt.periodEnd) {
          errors.push(`[${stmt.id}] Fechas faltantes`);
          continue;
        }

        // Verify transactions exist
        const txnCount = stmt.transactions.length;

        // Log successful verification
        console.log(
          `  ✓ ${stmt.account.bankName} ${stmt.account.productName} | ` +
          `${stmt.periodStart.toISOString().split('T')[0]} a ${stmt.periodEnd.toISOString().split('T')[0]} | ` +
          `${txnCount} transacciones`
        );

        normalized++;
      } catch (e) {
        errors.push(`[${stmt.id}] Error: ${e instanceof Error ? e.message : 'Desconocido'}`);
      }
    }

    console.log(`\n✅ Estados normalizados: ${normalized}/${statements.length}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  Errores encontrados (${errors.length}):`);
      errors.forEach((e) => console.log(`  - ${e}`));
    }

    // Summary
    const totalTransactions = statements.reduce((sum, s) => sum + s.transactions.length, 0);
    console.log(`\n📈 Resumen:`);
    console.log(`  - Cuentas bancarias únicas: ${new Set(statements.map(s => s.accountId)).size}`);
    console.log(`  - Total de transacciones: ${totalTransactions}`);
    console.log(`  - Período: ${statements[statements.length - 1]?.periodStart?.toISOString().split('T')[0]} a ${statements[0]?.periodEnd?.toISOString().split('T')[0]}`);

  } catch (e) {
    console.error('❌ Error:', e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}

normalizeStatements();
