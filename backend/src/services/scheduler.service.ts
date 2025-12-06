import cron from 'node-cron';
import prisma from '../config/database';
import DataSyncService from './sync.service';

// Sync all active tenants
async function syncAllTenants() {
  console.log('🔄 Starting scheduled sync for all tenants...');
  
  try {
    const activeTenants = await prisma.tenant.findMany({
      where: { 
        isActive: true,
        accessToken: { not: '' }
      }
    });

    console.log(`Found ${activeTenants.length} active tenants to sync`);

    for (const tenant of activeTenants) {
      try {
        console.log(`Syncing tenant: ${tenant.shopDomain}`);
        const syncService = new DataSyncService(
          tenant.id,
          tenant.shopDomain,
          tenant.accessToken
        );
        
        const result = await syncService.fullSync();
        console.log(`✅ Sync completed for ${tenant.shopDomain}:`, result);
      } catch (error: any) {
        console.error(`❌ Sync failed for ${tenant.shopDomain}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}

export function initializeScheduler() {
  console.log('📅 Initializing data sync scheduler...');

  // Run full sync every 6 hours
  cron.schedule('0 */6 * * *', () => {
    syncAllTenants();
  });

  // Run a lightweight sync every hour (only recent data)
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running hourly incremental sync...');
    // In production, this would only sync recent changes
    // For simplicity, we'll skip this for now
  });

  console.log('✅ Scheduler initialized - Full sync runs every 6 hours');
}

// Manual trigger for testing
export async function triggerManualSync(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant || !tenant.accessToken) {
    throw new Error('Tenant not found or not connected to Shopify');
  }

  const syncService = new DataSyncService(
    tenant.id,
    tenant.shopDomain,
    tenant.accessToken
  );

  return syncService.fullSync();
}

export default { initializeScheduler, triggerManualSync };
