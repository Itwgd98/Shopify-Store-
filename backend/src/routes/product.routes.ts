import { Router } from 'express';
import prisma from '../config/database';
import { asyncHandler, ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all products with pagination and search
router.get('/', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { 
    page = 1, 
    limit = 20, 
    search = '',
    status,
    sortBy = 'title',
    sortOrder = 'asc'
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const where: any = { tenantId };
  
  if (search) {
    where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { vendor: { contains: search as string, mode: 'insensitive' } },
      { productType: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  if (status) {
    where.status = status;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit),
      select: {
        id: true,
        shopifyProductId: true,
        title: true,
        vendor: true,
        productType: true,
        status: true,
        price: true,
        totalInventory: true,
        imageUrl: true,
        shopifyCreatedAt: true
      }
    }),
    prisma.product.count({ where })
  ]);

  res.json({
    success: true,
    data: {
      products: products.map((p: any) => ({
        ...p,
        price: Number(p.price)
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

// Get single product with sales data
router.get('/:id', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const product = await prisma.product.findFirst({
    where: { id, tenantId }
  });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  // Get sales statistics
  const salesStats = await prisma.orderItem.aggregate({
    where: { productId: id },
    _sum: { quantity: true },
    _count: true
  });

  const revenueStats = await prisma.$queryRaw<Array<{ total: any }>>`
    SELECT COALESCE(SUM(price * quantity), 0) as total
    FROM "OrderItem"
    WHERE "productId" = ${id}
  `;

  res.json({
    success: true,
    data: {
      ...product,
      price: Number(product.price),
      compareAtPrice: Number(product.compareAtPrice),
      sales: {
        totalUnitsSold: salesStats._sum.quantity || 0,
        totalOrders: salesStats._count,
        totalRevenue: Number(revenueStats[0]?.total) || 0
      }
    }
  });
}));

// Get product inventory status
router.get('/inventory/status', asyncHandler(async (req: AuthRequest, res: any) => {
  const tenantId = req.tenantId!;

  const [inStock, lowStock, outOfStock] = await Promise.all([
    prisma.product.count({ where: { tenantId, totalInventory: { gt: 10 } } }),
    prisma.product.count({ where: { tenantId, totalInventory: { gt: 0, lte: 10 } } }),
    prisma.product.count({ where: { tenantId, totalInventory: { lte: 0 } } })
  ]);

  const lowStockProducts = await prisma.product.findMany({
    where: { tenantId, totalInventory: { gt: 0, lte: 10 } },
    select: {
      id: true,
      title: true,
      totalInventory: true,
      imageUrl: true
    },
    orderBy: { totalInventory: 'asc' },
    take: 10
  });

  res.json({
    success: true,
    data: {
      summary: {
        inStock,
        lowStock,
        outOfStock,
        total: inStock + lowStock + outOfStock
      },
      lowStockProducts
    }
  });
}));

export default router;
