import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all orders with pagination and filtering
router.get('/', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { 
    page = 1, 
    limit = 20, 
    search = '',
    status,
    startDate,
    endDate,
    sortBy = 'shopifyCreatedAt',
    sortOrder = 'desc'
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: any = { tenantId };
  
  if (search) {
    where.OR = [
      { email: { contains: search as string, mode: 'insensitive' } },
      { orderNumber: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (status) {
    where.financialStatus = status;
  }

  if (startDate || endDate) {
    where.shopifyCreatedAt = {};
    if (startDate) where.shopifyCreatedAt.gte = new Date(startDate as string);
    if (endDate) where.shopifyCreatedAt.lte = new Date(endDate as string);
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit),
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: { orderItems: true }
        }
      }
    }),
    prisma.order.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      orders: orders.map((o: any) => ({
        id: o.id,
        shopifyOrderId: o.shopifyOrderId,
        orderNumber: o.orderNumber,
        email: o.email,
        totalPrice: Number(o.totalPrice),
        currency: o.currency,
        financialStatus: o.financialStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        itemCount: o._count.orderItems,
        customer: o.customer ? {
          id: o.customer.id,
          name: [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ') || o.customer.email
        } : null,
        createdAt: o.shopifyCreatedAt
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

// Get single order with items
router.get('/:id', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true
        }
      },
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              imageUrl: true
            }
          }
        }
      }
    }
  });

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  res.json({
    success: true,
    data: {
      id: order.id,
      shopifyOrderId: order.shopifyOrderId,
      orderNumber: order.orderNumber,
      email: order.email,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      totalPrice: Number(order.totalPrice),
      subtotalPrice: Number(order.subtotalPrice),
      totalTax: Number(order.totalTax),
      totalDiscounts: Number(order.totalDiscounts),
      totalShipping: Number(order.totalShipping),
      currency: order.currency,
      note: order.note,
      tags: order.tags,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      createdAt: order.shopifyCreatedAt,
      customer: order.customer,
      items: order.orderItems.map((item: any) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        price: Number(item.price),
        totalDiscount: Number(item.totalDiscount),
        sku: item.sku,
        variantTitle: item.variantTitle,
        product: item.product
      }))
    }
  });
}));

// Get order statistics
router.get('/stats/summary', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;

  const [total, paid, pending, refunded] = await Promise.all([
    prisma.order.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId, financialStatus: 'paid' } }),
    prisma.order.count({ where: { tenantId, financialStatus: 'pending' } }),
    prisma.order.count({ where: { tenantId, financialStatus: 'refunded' } })
  ]);

  res.json({
    success: true,
    data: {
      total,
      paid,
      pending,
      refunded,
      other: total - paid - pending - refunded
    }
  });
}));

export default router;
