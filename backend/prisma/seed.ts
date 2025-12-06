import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create tenant for the Shopify store
  const tenant = await prisma.tenant.upsert({
    where: { shopDomain: 'your-store.myshopify.com' },
    update: {},
    create: {
      shopDomain: 'your-store.myshopify.com',
      shopName: 'Your Store',
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
      isActive: true,
      syncEnabled: true
    }
  });

  console.log('✅ Created tenant:', tenant.shopName);

  // Create user
  const passwordHash = await bcrypt.hash('demo123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo Admin',
      role: 'ADMIN',
      tenantId: tenant.id
    }
  });

  console.log('✅ Created user:', user.email);
  console.log('');
  console.log('📋 Login credentials:');
  console.log('   Email: demo@example.com');
  console.log('   Password: demo123');
  console.log('');
  console.log('🔗 Store connected: project-1234567986.myshopify.com');
  console.log('');
  console.log('💡 No demo data added - sync with Shopify to get real data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
