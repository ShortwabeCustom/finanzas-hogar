const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const statements = await prisma.bankStatement.findMany({
      include: { account: true, transactions: { take: 1 } },
    });

    console.log(`\n📊 Total BankStatements: ${statements.length}`);

    if (statements.length > 0) {
      console.log('\n📋 Primeros 3 estados:');
      statements.slice(0, 3).forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.account?.bankName} ${s.account?.productName}`);
        console.log(`     Período: ${s.periodStart.toISOString().split('T')[0]} a ${s.periodEnd.toISOString().split('T')[0]}`);
        console.log(`     Transacciones: ${s.transactions.length}`);
      });
    } else {
      console.log('⚠️  No hay estados de cuenta en la base de datos.');
    }

    const accounts = await prisma.bankAccount.findMany();
    console.log(`\n🏦 Total BankAccounts: ${accounts.length}`);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
