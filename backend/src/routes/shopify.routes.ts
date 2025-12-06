import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { shopifyOAuth } from '../services/shopify.service';
import DataSyncService from '../services/sync.service';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Generate OAuth URL for Shopify app installation
router.get('/auth', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const { shop } = req.query;

  if (!shop || typeof shop !== 'string') {
    throw new ApiError(400, 'Shop domain is required');
  }

  // Validate shop domain format
  const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;
  
  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state in session/db for verification (simplified - in production use Redis)
  await prisma.tenant.update({
    where: { id: req.tenantId },
    data: { 
      shopDomain,
      webhookSecret: state // Temporarily store state
    }
  });

  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/shopify/callback`;
  const authUrl = shopifyOAuth.generateAuthUrl(shopDomain, redirectUri, state);

  res.json({
    success: true,
    data: { authUrl }
  });
}));

// OAuth callback handler
router.get('/callback', asyncHandler(async (req: any, res: any) => {
  const { code, shop, state, hmac } = req.query;

  if (!code || !shop || !state) {
    throw new ApiError(400, 'Missing required parameters');
  }

  // Find tenant by shop domain
  const tenant = await prisma.tenant.findUnique({
    where: { shopDomain: shop as string }
  });

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  // Verify state (CSRF protection)
  if (tenant.webhookSecret !== state) {
    throw new ApiError(400, 'Invalid state parameter');
  }

  try {
    // Exchange code for access token
    const accessToken = await shopifyOAuth.exchangeCodeForToken(shop as string, code as string);

    // Generate new webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Update tenant with access token
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        accessToken,
        webhookSecret,
        installedAt: new Date()
      }
    });

    // Redirect to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?shopify=connected`);
  } catch (error: any) {
    console.error('OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?shopify=error&message=${encodeURIComponent(error.message)}`);
  }
}));

// Disconnect Shopify store
router.post('/disconnect', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  await prisma.tenant.update({
    where: { id: req.tenantId },
    data: {
      accessToken: '',
      uninstalledAt: new Date()
    }
  });

  res.json({
    success: true,
    message: 'Shopify store disconnected'
  });
}));

// Manual sync trigger
router.post('/sync', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId }
  });

  if (!tenant || !tenant.accessToken) {
    throw new ApiError(400, 'Shopify store not connected');
  }

  const syncService = new DataSyncService(
    tenant.id,
    tenant.shopDomain,
    tenant.accessToken
  );

  // Start sync in background
  syncService.fullSync()
    .then(result => console.log('Sync completed:', result))
    .catch(error => console.error('Sync error:', error));

  res.json({
    success: true,
    message: 'Sync started in background'
  });
}));

// Full sync trigger
router.post('/sync/full', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId }
  });

  if (!tenant || !tenant.accessToken) {
    throw new ApiError(400, 'Shopify store not connected');
  }

  const syncService = new DataSyncService(
    tenant.id,
    tenant.shopDomain,
    tenant.accessToken
  );

  // Start full sync in background
  syncService.fullSync()
    .then(result => console.log('Full sync completed:', result))
    .catch(error => console.error('Full sync error:', error));

  res.json({
    success: true,
    message: 'Full sync started in background'
  });
}));

// Incremental sync trigger
router.post('/sync/incremental', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId }
  });

  if (!tenant || !tenant.accessToken) {
    throw new ApiError(400, 'Shopify store not connected');
  }

  const syncService = new DataSyncService(
    tenant.id,
    tenant.shopDomain,
    tenant.accessToken
  );

  // Start incremental sync in background
  syncService.incrementalSync()
    .then(result => console.log('Incremental sync completed:', result))
    .catch(error => console.error('Incremental sync error:', error));

  res.json({
    success: true,
    message: 'Incremental sync started in background'
  });
}));

// Get sync status
router.get('/sync/status', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId }
  });

  const latestSync = await prisma.syncLog.findFirst({
    where: { tenantId: req.tenantId },
    orderBy: { startedAt: 'desc' }
  });

  res.json({
    success: true,
    data: {
      isConnected: !!tenant?.accessToken,
      lastSyncAt: tenant?.lastSyncAt,
      latestSync
    }
  });
}));

// Get connection status
router.get('/status', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId }
  });

  res.json({
    success: true,
    data: {
      isConnected: !!tenant?.accessToken,
      shopDomain: tenant?.shopDomain,
      shopName: tenant?.shopName,
      lastSyncAt: tenant?.lastSyncAt
    }
  });
}));

// Get sync history
router.get('/sync/history', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    prisma.syncLog.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { startedAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.syncLog.count({ where: { tenantId: req.tenantId } })
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

export default router;
