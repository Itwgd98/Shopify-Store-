import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current tenant details
router.get('/current', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    include: {
      _count: {
        select: {
          customers: true,
          orders: true,
          products: true,
          users: true
        }
      }
    }
  });

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  res.json({
    success: true,
    data: {
      id: tenant.id,
      shopDomain: tenant.shopDomain,
      shopName: tenant.shopName,
      isActive: tenant.isActive,
      isConnected: !!tenant.accessToken,
      installedAt: tenant.installedAt,
      lastSyncAt: tenant.lastSyncAt,
      counts: tenant._count
    }
  });
}));

// Update tenant settings
router.put('/current', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: any) => {
  const { shopName } = req.body;

  const tenant = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: { shopName }
  });

  res.json({
    success: true,
    data: tenant
  });
}));

// Get tenant settings (for settings page)
router.get('/settings', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: {
      id: true,
      shopName: true,
      shopDomain: true,
      accessToken: true,
      isActive: true,
      lastSyncAt: true,
      syncEnabled: true
    }
  });

  if (!tenant) {
    throw new ApiError(404, 'Tenant not found');
  }

  res.json({
    success: true,
    data: {
      id: tenant.id,
      name: tenant.shopName,
      shopifyDomain: tenant.shopDomain,
      shopifyAccessToken: tenant.accessToken ? '••••••••' : '',
      syncEnabled: tenant.isActive,
      lastSyncAt: tenant.lastSyncAt
    }
  });
}));

// Update tenant settings (for settings page)
router.put('/settings', asyncHandler(async (req: AuthRequest, res: any) => {
  const { name, shopifyDomain, shopifyAccessToken, syncEnabled } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.shopName = name;
  if (shopifyDomain !== undefined) updateData.shopDomain = shopifyDomain;
  if (shopifyAccessToken !== undefined && !shopifyAccessToken.includes('••')) {
    updateData.accessToken = shopifyAccessToken;
  }
  if (syncEnabled !== undefined) updateData.isActive = syncEnabled;

  const tenant = await prisma.tenant.update({
    where: { id: req.tenantId },
    data: updateData
  });

  res.json({
    success: true,
    data: tenant
  });
}));

// Get sync history
router.get('/sync-logs', asyncHandler(async (req: AuthRequest, res: any) => {
  const { page = 1, limit = 20 } = req.query;
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

// Get team members
router.get('/users', asyncHandler(async (req: AuthRequest, res: any) => {
  const users = await prisma.user.findMany({
    where: { tenantId: req.tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    success: true,
    data: users
  });
}));

// Invite new team member
router.post('/users', requireRole('ADMIN'), asyncHandler(async (req: AuthRequest, res: any) => {
  const { email, name, role = 'MEMBER' } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  // Check if user exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(400, 'User with this email already exists');
  }

  // Create user with temporary password
  const bcrypt = require('bcryptjs');
  const tempPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
      tenantId: req.tenantId!
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true
    }
  });

  // In production, send email with temp password
  res.status(201).json({
    success: true,
    data: user,
    message: 'User created. Temporary password: ' + tempPassword
  });
}));

export default router;
