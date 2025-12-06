import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Register new user
router.post('/register', asyncHandler(async (req: any, res: any) => {
  const { email, password, name, shopDomain } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create tenant and user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create or find tenant
    let tenant = shopDomain 
      ? await tx.tenant.findUnique({ where: { shopDomain } })
      : null;

    if (!tenant) {
      tenant = await tx.tenant.create({
        data: {
          shopDomain: shopDomain || `tenant-${Date.now()}.myshopify.com`,
          shopName: name ? `${name}'s Store` : 'My Store',
          accessToken: '', // Will be set during Shopify OAuth
        }
      });
    }

    // Create user
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        tenantId: tenant.id,
        role: 'ADMIN' // First user is admin
      }
    });

    return { user, tenant };
  });

  // Generate JWT
  const token = jwt.sign(
    {
      userId: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      role: result.user.role
    },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '7d' as const }
  );

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role
      },
      tenant: {
        id: result.tenant.id,
        shopDomain: result.tenant.shopDomain,
        shopName: result.tenant.shopName
      },
      token
    }
  });
}));

// Login
router.post('/login', asyncHandler(async (req: any, res: any) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true }
  });

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new ApiError(401, 'Account is disabled');
  }

  if (!user.tenant.isActive) {
    throw new ApiError(401, 'Store is inactive');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  // Generate JWT
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role
    },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: '7d' as const }
  );

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: user.tenant.id,
        shopDomain: user.tenant.shopDomain,
        shopName: user.tenant.shopName,
        isConnected: !!user.tenant.accessToken
      },
      token
    }
  });
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { tenant: true }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: user.tenant.id,
        shopDomain: user.tenant.shopDomain,
        shopName: user.tenant.shopName,
        isConnected: !!user.tenant.accessToken,
        lastSyncAt: user.tenant.lastSyncAt
      }
    }
  });
}));

// Update password
router.put('/password', authenticate, asyncHandler(async (req: AuthRequest, res: any) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current and new password are required');
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
}));

export default router;
