import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all customers with pagination and search
router.get('/', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { 
    page = 1, 
    limit = 20, 
    search = '',
    sortBy = 'totalSpent',
    sortOrder = 'desc'
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: any = { tenantId };
  
  if (search) {
    where.OR = [
      { email: { contains: search as string, mode: 'insensitive' } },
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit),
      select: {
        id: true,
        shopifyCustomerId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        ordersCount: true,
        totalSpent: true,
        acceptsMarketing: true,
        shopifyCreatedAt: true
      }
    }),
    prisma.customer.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      customers: customers.map(c => ({
        ...c,
        totalSpent: Number(c.totalSpent),
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'N/A'
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

// Get single customer with orders
router.get('/:id', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      orders: {
        orderBy: { shopifyCreatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          totalPrice: true,
          financialStatus: true,
          fulfillmentStatus: true,
          shopifyCreatedAt: true
        }
      }
    }
  });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  res.json({
    success: true,
    data: {
      ...customer,
      totalSpent: Number(customer.totalSpent),
      orders: customer.orders.map(o => ({
        ...o,
        totalPrice: Number(o.totalPrice)
      }))
    }
  });
}));

// Get customer stats
router.get('/:id/stats', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId }
  });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const orderStats = await prisma.order.aggregate({
    where: { customerId: id },
    _avg: { totalPrice: true },
    _max: { totalPrice: true },
    _min: { totalPrice: true },
    _count: true
  });

  const recentOrders = await prisma.order.findMany({
    where: { customerId: id },
    orderBy: { shopifyCreatedAt: 'desc' },
    take: 5
  });

  res.json({
    success: true,
    data: {
      averageOrderValue: Number(orderStats._avg.totalPrice) || 0,
      maxOrderValue: Number(orderStats._max.totalPrice) || 0,
      minOrderValue: Number(orderStats._min.totalPrice) || 0,
      totalOrders: orderStats._count,
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalPrice: Number(o.totalPrice),
        date: o.shopifyCreatedAt
      }))
    }
  });
}));

export default router;
