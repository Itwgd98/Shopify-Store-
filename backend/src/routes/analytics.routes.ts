import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Prisma } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============ SUMMARY METRICS ============

// Get dashboard summary (total customers, orders, revenue)
router.get('/summary', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;

  const [customerCount, orderCount, revenueResult, productCount] = await Promise.all([
    prisma.customer.count({ where: { tenantId } }),
    prisma.order.count({ where: { tenantId } }),
    prisma.order.aggregate({
      where: { tenantId },
      _sum: { totalPrice: true }
    }),
    prisma.product.count({ where: { tenantId } })
  ]);

  // Get previous period for comparison (last 30 days vs previous 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [currentPeriod, previousPeriod] = await Promise.all([
    prisma.order.aggregate({
      where: {
        tenantId,
        shopifyCreatedAt: { gte: thirtyDaysAgo }
      },
      _sum: { totalPrice: true },
      _count: true
    }),
    prisma.order.aggregate({
      where: {
        tenantId,
        shopifyCreatedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
      },
      _sum: { totalPrice: true },
      _count: true
    })
  ]);

  // Calculate trends
  const currentRevenue = Number(currentPeriod._sum.totalPrice) || 0;
  const previousRevenue = Number(previousPeriod._sum.totalPrice) || 0;
  const revenueTrend = previousRevenue > 0 
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
    : 0;

  const currentOrders = currentPeriod._count || 0;
  const previousOrders = previousPeriod._count || 0;
  const ordersTrend = previousOrders > 0 
    ? ((currentOrders - previousOrders) / previousOrders) * 100 
    : 0;

  res.json({
    success: true,
    data: {
      totalCustomers: customerCount,
      totalOrders: orderCount,
      totalRevenue: Number(revenueResult._sum.totalPrice) || 0,
      totalProducts: productCount,
      trends: {
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          percentChange: Math.round(revenueTrend * 100) / 100
        },
        orders: {
          current: currentOrders,
          previous: previousOrders,
          percentChange: Math.round(ordersTrend * 100) / 100
        }
      }
    }
  });
}));

// ============ ORDERS BY DATE ============

// Get orders by date with filtering
router.get('/orders-by-date', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { startDate, endDate, granularity = 'day' } = req.query;

  // Default to last 30 days
  const end = endDate ? new Date(endDate as string) : new Date();
  const start = startDate 
    ? new Date(startDate as string) 
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Raw SQL for date grouping
  let dateFormat: string;
  switch (granularity) {
    case 'week':
      dateFormat = 'YYYY-WW';
      break;
    case 'month':
      dateFormat = 'YYYY-MM';
      break;
    default:
      dateFormat = 'YYYY-MM-DD';
  }

  const orders = await prisma.$queryRaw<Array<{ date: string; count: bigint; revenue: any }>>`
    SELECT 
      TO_CHAR("shopifyCreatedAt", ${dateFormat}) as date,
      COUNT(*) as count,
      COALESCE(SUM("totalPrice"), 0) as revenue
    FROM "Order"
    WHERE "tenantId" = ${tenantId}
      AND "shopifyCreatedAt" >= ${start}
      AND "shopifyCreatedAt" <= ${end}
    GROUP BY TO_CHAR("shopifyCreatedAt", ${dateFormat})
    ORDER BY date ASC
  `;

  res.json({
    success: true,
    data: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      granularity,
      orders: orders.map(o => ({
        date: o.date,
        count: Number(o.count),
        revenue: Number(o.revenue)
      }))
    }
  });
}));

// ============ TOP CUSTOMERS ============

// Get top customers by spend
router.get('/top-customers', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { limit = 5 } = req.query;

  const topCustomers = await prisma.customer.findMany({
    where: { tenantId },
    orderBy: { totalSpent: 'desc' },
    take: Number(limit),
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      totalSpent: true,
      ordersCount: true
    }
  });

  res.json({
    success: true,
    data: topCustomers.map(c => ({
      ...c,
      totalSpent: Number(c.totalSpent),
      name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unknown'
    }))
  });
}));

// ============ REVENUE TRENDS ============

// Get revenue trend over time
router.get('/revenue-trend', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { days = 30 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));

  const trend = await prisma.$queryRaw<Array<{ date: string; revenue: any; orders: bigint }>>`
    SELECT 
      DATE("shopifyCreatedAt") as date,
      COALESCE(SUM("totalPrice"), 0) as revenue,
      COUNT(*) as orders
    FROM "Order"
    WHERE "tenantId" = ${tenantId}
      AND "shopifyCreatedAt" >= ${startDate}
    GROUP BY DATE("shopifyCreatedAt")
    ORDER BY date ASC
  `;

  res.json({
    success: true,
    data: trend.map(t => ({
      date: t.date,
      revenue: Number(t.revenue),
      orders: Number(t.orders)
    }))
  });
}));

// ============ PRODUCT PERFORMANCE ============

// Get top selling products
router.get('/top-products', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { limit = 10 } = req.query;

  const topProducts = await prisma.$queryRaw<Array<{ 
    productId: string; 
    title: string; 
    totalQuantity: bigint; 
    totalRevenue: any 
  }>>`
    SELECT 
      p.id as "productId",
      p.title,
      COALESCE(SUM(oi.quantity), 0) as "totalQuantity",
      COALESCE(SUM(oi.price * oi.quantity), 0) as "totalRevenue"
    FROM "Product" p
    LEFT JOIN "OrderItem" oi ON p.id = oi."productId"
    WHERE p."tenantId" = ${tenantId}
    GROUP BY p.id, p.title
    ORDER BY "totalRevenue" DESC
    LIMIT ${Number(limit)}
  `;

  res.json({
    success: true,
    data: topProducts.map(p => ({
      productId: p.productId,
      title: p.title,
      totalQuantity: Number(p.totalQuantity),
      totalRevenue: Number(p.totalRevenue)
    }))
  });
}));

// ============ ORDER STATUS BREAKDOWN ============

// Get order status distribution
router.get('/order-status', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;

  const statusBreakdown = await prisma.order.groupBy({
    by: ['financialStatus'],
    where: { tenantId },
    _count: true,
    _sum: { totalPrice: true }
  });

  const fulfillmentBreakdown = await prisma.order.groupBy({
    by: ['fulfillmentStatus'],
    where: { tenantId },
    _count: true
  });

  res.json({
    success: true,
    data: {
      financial: statusBreakdown.map(s => ({
        status: s.financialStatus || 'unknown',
        count: s._count,
        revenue: Number(s._sum.totalPrice) || 0
      })),
      fulfillment: fulfillmentBreakdown.map(s => ({
        status: s.fulfillmentStatus || 'unfulfilled',
        count: s._count
      }))
    }
  });
}));

// ============ ABANDONED CART ANALYTICS ============

// Get abandoned cart stats
router.get('/abandoned-carts', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;

  const [total, recovered, recentCarts] = await Promise.all([
    prisma.abandonedCart.count({ where: { tenantId } }),
    prisma.abandonedCart.count({ where: { tenantId, isRecovered: true } }),
    prisma.abandonedCart.findMany({
      where: { tenantId, isRecovered: false },
      orderBy: { abandonedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        email: true,
        totalPrice: true,
        itemCount: true,
        abandonedAt: true,
        checkoutStartedAt: true
      }
    })
  ]);

  const potentialRevenue = await prisma.abandonedCart.aggregate({
    where: { tenantId, isRecovered: false },
    _sum: { totalPrice: true }
  });

  res.json({
    success: true,
    data: {
      total,
      recovered,
      recoveryRate: total > 0 ? Math.round((recovered / total) * 100) : 0,
      potentialRevenue: Number(potentialRevenue._sum.totalPrice) || 0,
      recentCarts: recentCarts.map(c => ({
        ...c,
        totalPrice: Number(c.totalPrice)
      }))
    }
  });
}));

// ============ CUSTOMER ACQUISITION ============

// Get new customers over time
router.get('/customer-acquisition', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { days = 30 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));

  const acquisition = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
    SELECT 
      DATE("shopifyCreatedAt") as date,
      COUNT(*) as count
    FROM "Customer"
    WHERE "tenantId" = ${tenantId}
      AND "shopifyCreatedAt" >= ${startDate}
    GROUP BY DATE("shopifyCreatedAt")
    ORDER BY date ASC
  `;

  res.json({
    success: true,
    data: acquisition.map(a => ({
      date: a.date,
      count: Number(a.count)
    }))
  });
}));

// ============ AVERAGE ORDER VALUE ============

// Get AOV trend
router.get('/aov-trend', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { days = 30 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));

  const aovTrend = await prisma.$queryRaw<Array<{ date: string; aov: any; orders: bigint }>>`
    SELECT 
      DATE("shopifyCreatedAt") as date,
      AVG("totalPrice") as aov,
      COUNT(*) as orders
    FROM "Order"
    WHERE "tenantId" = ${tenantId}
      AND "shopifyCreatedAt" >= ${startDate}
    GROUP BY DATE("shopifyCreatedAt")
    ORDER BY date ASC
  `;

  // Calculate overall AOV
  const overallAOV = await prisma.order.aggregate({
    where: { tenantId },
    _avg: { totalPrice: true }
  });

  res.json({
    success: true,
    data: {
      overall: Number(overallAOV._avg.totalPrice) || 0,
      trend: aovTrend.map(a => ({
        date: a.date,
        aov: Number(a.aov),
        orders: Number(a.orders)
      }))
    }
  });
}));

export default router;
