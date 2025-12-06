import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { ShopifyClient } from '../services/shopify.service';

const router = Router();

// Verify Shopify webhook signature
function verifyShopifyWebhook(req: Request, secret: string): boolean {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  if (!hmacHeader) return false;

  const body = (req as any).body;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

// Get tenant from shop domain
async function getTenantFromShop(shopDomain: string) {
  return prisma.tenant.findUnique({
    where: { shopDomain }
  });
}

// ============ ORDER WEBHOOKS ============

// Order Created
router.post('/orders/create', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Verify webhook (simplified - in production always verify)
    // if (!verifyShopifyWebhook(req, tenant.webhookSecret || '')) {
    //   return res.status(401).json({ error: 'Invalid webhook signature' });
    // }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const order = body;

    // Find customer reference
    let customerId: string | null = null;
    if (order.customer?.id) {
      const customer = await prisma.customer.findUnique({
        where: {
          tenantId_shopifyCustomerId: {
            tenantId: tenant.id,
            shopifyCustomerId: order.customer.id.toString()
          }
        }
      });
      customerId = customer?.id || null;
    }

    // Create or update order
    await prisma.order.upsert({
      where: {
        tenantId_shopifyOrderId: {
          tenantId: tenant.id,
          shopifyOrderId: order.id.toString()
        }
      },
      update: {
        orderNumber: order.order_number?.toString(),
        email: order.email,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        totalPrice: parseFloat(order.total_price || '0'),
        subtotalPrice: order.subtotal_price ? parseFloat(order.subtotal_price) : null,
        totalTax: order.total_tax ? parseFloat(order.total_tax) : null,
        totalDiscounts: order.total_discounts ? parseFloat(order.total_discounts) : null,
        currency: order.currency || 'USD',
        shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
        shopifyUpdatedAt: order.updated_at ? new Date(order.updated_at) : null,
        customerId
      },
      create: {
        tenantId: tenant.id,
        shopifyOrderId: order.id.toString(),
        orderNumber: order.order_number?.toString(),
        email: order.email,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        totalPrice: parseFloat(order.total_price || '0'),
        subtotalPrice: order.subtotal_price ? parseFloat(order.subtotal_price) : null,
        totalTax: order.total_tax ? parseFloat(order.total_tax) : null,
        totalDiscounts: order.total_discounts ? parseFloat(order.total_discounts) : null,
        currency: order.currency || 'USD',
        shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
        shopifyUpdatedAt: order.updated_at ? new Date(order.updated_at) : null,
        customerId
      }
    });

    // Log webhook
    await prisma.syncLog.create({
      data: {
        tenantId: tenant.id,
        syncType: 'WEBHOOK',
        status: 'COMPLETED',
        recordsCount: 1,
        completedAt: new Date()
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (orders/create):', error);
    res.status(500).json({ error: error.message });
  }
});

// Order Updated
router.post('/orders/updated', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const order = body;

    await prisma.order.updateMany({
      where: {
        tenantId: tenant.id,
        shopifyOrderId: order.id.toString()
      },
      data: {
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        totalPrice: parseFloat(order.total_price || '0'),
        cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
        cancelReason: order.cancel_reason,
        shopifyUpdatedAt: new Date()
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (orders/updated):', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CUSTOMER WEBHOOKS ============

// Customer Created
router.post('/customers/create', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const customer = body;

    await prisma.customer.upsert({
      where: {
        tenantId_shopifyCustomerId: {
          tenantId: tenant.id,
          shopifyCustomerId: customer.id.toString()
        }
      },
      update: {
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        ordersCount: customer.orders_count || 0,
        totalSpent: parseFloat(customer.total_spent || '0'),
        acceptsMarketing: customer.accepts_marketing || false,
        shopifyUpdatedAt: new Date()
      },
      create: {
        tenantId: tenant.id,
        shopifyCustomerId: customer.id.toString(),
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        ordersCount: customer.orders_count || 0,
        totalSpent: parseFloat(customer.total_spent || '0'),
        acceptsMarketing: customer.accepts_marketing || false,
        shopifyCreatedAt: customer.created_at ? new Date(customer.created_at) : null
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (customers/create):', error);
    res.status(500).json({ error: error.message });
  }
});

// Customer Updated
router.post('/customers/updated', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const customer = body;

    await prisma.customer.updateMany({
      where: {
        tenantId: tenant.id,
        shopifyCustomerId: customer.id.toString()
      },
      data: {
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        ordersCount: customer.orders_count || 0,
        totalSpent: parseFloat(customer.total_spent || '0'),
        acceptsMarketing: customer.accepts_marketing || false,
        shopifyUpdatedAt: new Date()
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (customers/updated):', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCT WEBHOOKS ============

// Product Created/Updated
router.post('/products/create', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const product = body;
    const firstVariant = product.variants?.[0];

    await prisma.product.upsert({
      where: {
        tenantId_shopifyProductId: {
          tenantId: tenant.id,
          shopifyProductId: product.id.toString()
        }
      },
      update: {
        title: product.title,
        description: product.body_html,
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
        status: product.status || 'active',
        imageUrl: product.image?.src,
        price: firstVariant ? parseFloat(firstVariant.price || '0') : null,
        shopifyUpdatedAt: new Date()
      },
      create: {
        tenantId: tenant.id,
        shopifyProductId: product.id.toString(),
        title: product.title,
        description: product.body_html,
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
        status: product.status || 'active',
        imageUrl: product.image?.src,
        price: firstVariant ? parseFloat(firstVariant.price || '0') : null,
        shopifyCreatedAt: product.created_at ? new Date(product.created_at) : null
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (products/create):', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/products/update', async (req: Request, res: Response) => {
  // Products/update uses the same logic as create (upsert handles both)
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await prisma.tenant.findUnique({
      where: { shopDomain }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const product = body;

    const firstVariant = product.variants?.[0];
    
    await prisma.product.upsert({
      where: {
        tenantId_shopifyProductId: {
          tenantId: tenant.id,
          shopifyProductId: product.id.toString()
        }
      },
      update: {
        title: product.title,
        description: product.body_html,
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
        status: product.status || 'active',
        tags: product.tags?.split(',').map((t: string) => t.trim()) || [],
        imageUrl: product.image?.src || product.images?.[0]?.src,
        price: firstVariant ? parseFloat(firstVariant.price || '0') : null,
        compareAtPrice: firstVariant?.compare_at_price ? parseFloat(firstVariant.compare_at_price) : null,
        totalInventory: product.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0,
        shopifyCreatedAt: product.created_at ? new Date(product.created_at) : null,
        shopifyUpdatedAt: product.updated_at ? new Date(product.updated_at) : null
      },
      create: {
        tenantId: tenant.id,
        shopifyProductId: product.id.toString(),
        title: product.title,
        description: product.body_html,
        vendor: product.vendor,
        productType: product.product_type,
        handle: product.handle,
        status: product.status || 'active',
        tags: product.tags?.split(',').map((t: string) => t.trim()) || [],
        imageUrl: product.image?.src || product.images?.[0]?.src,
        price: firstVariant ? parseFloat(firstVariant.price || '0') : null,
        compareAtPrice: firstVariant?.compare_at_price ? parseFloat(firstVariant.compare_at_price) : null,
        totalInventory: product.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0,
        shopifyCreatedAt: product.created_at ? new Date(product.created_at) : null,
        shopifyUpdatedAt: product.updated_at ? new Date(product.updated_at) : null
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (products/update):', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ CHECKOUT WEBHOOKS (Abandoned Cart) ============

// Checkout Created (Cart Started)
router.post('/checkouts/create', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const checkout = body;

    // Find customer reference
    let customerId: string | null = null;
    if (checkout.customer?.id) {
      const customer = await prisma.customer.findUnique({
        where: {
          tenantId_shopifyCustomerId: {
            tenantId: tenant.id,
            shopifyCustomerId: checkout.customer.id.toString()
          }
        }
      });
      customerId = customer?.id || null;
    }

    await prisma.abandonedCart.upsert({
      where: {
        tenantId_shopifyCheckoutId: {
          tenantId: tenant.id,
          shopifyCheckoutId: checkout.id.toString()
        }
      },
      update: {
        email: checkout.email,
        totalPrice: checkout.total_price ? parseFloat(checkout.total_price) : null,
        itemCount: checkout.line_items?.length || 0,
        cartItems: checkout.line_items,
        checkoutStartedAt: new Date(),
        customerId
      },
      create: {
        tenantId: tenant.id,
        shopifyCheckoutId: checkout.id.toString(),
        shopifyCartToken: checkout.cart_token,
        email: checkout.email,
        totalPrice: checkout.total_price ? parseFloat(checkout.total_price) : null,
        itemCount: checkout.line_items?.length || 0,
        cartItems: checkout.line_items,
        checkoutStartedAt: new Date(),
        customerId
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (checkouts/create):', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkout Updated (potentially abandoned)
router.post('/checkouts/update', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const tenant = await getTenantFromShop(shopDomain);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const checkout = body;

    // If completed, mark as recovered
    if (checkout.completed_at) {
      await prisma.abandonedCart.updateMany({
        where: {
          tenantId: tenant.id,
          shopifyCheckoutId: checkout.id.toString()
        },
        data: {
          isRecovered: true,
          recoveredAt: new Date(checkout.completed_at)
        }
      });
    } else {
      // Mark as abandoned if not completed
      await prisma.abandonedCart.updateMany({
        where: {
          tenantId: tenant.id,
          shopifyCheckoutId: checkout.id.toString()
        },
        data: {
          abandonedAt: new Date(),
          totalPrice: checkout.total_price ? parseFloat(checkout.total_price) : null,
          itemCount: checkout.line_items?.length || 0,
          cartItems: checkout.line_items
        }
      });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (checkouts/update):', error);
    res.status(500).json({ error: error.message });
  }
});

// App Uninstalled
router.post('/app/uninstalled', async (req: Request, res: Response) => {
  try {
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    
    await prisma.tenant.updateMany({
      where: { shopDomain },
      data: {
        accessToken: '',
        isActive: false,
        uninstalledAt: new Date()
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error (app/uninstalled):', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
