import prisma from '../config/database';
import ShopifyClient from './shopify.service';
import { SyncType, SyncStatus } from '@prisma/client';

export class DataSyncService {
  private tenantId: string;
  private shopifyClient: ShopifyClient;

  constructor(tenantId: string, shopDomain: string, accessToken: string) {
    this.tenantId = tenantId;
    this.shopifyClient = new ShopifyClient({ shopDomain, accessToken });
  }

  // Create sync log entry
  private async createSyncLog(syncType: SyncType) {
    return prisma.syncLog.create({
      data: {
        tenantId: this.tenantId,
        syncType,
        status: SyncStatus.IN_PROGRESS
      }
    });
  }

  // Update sync log on completion
  private async completeSyncLog(logId: string, status: SyncStatus, recordsCount: number, errorMessage?: string) {
    return prisma.syncLog.update({
      where: { id: logId },
      data: {
        status,
        recordsCount,
        errorMessage,
        completedAt: new Date()
      }
    });
  }

  // ============ SYNC CUSTOMERS ============
  async syncCustomers(): Promise<number> {
    const log = await this.createSyncLog(SyncType.CUSTOMERS);
    let count = 0;

    try {
      const customers = await this.shopifyClient.getAllCustomers();

      for (const customer of customers) {
        await prisma.customer.upsert({
          where: {
            tenantId_shopifyCustomerId: {
              tenantId: this.tenantId,
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
            currency: customer.currency || 'USD',
            tags: customer.tags?.split(',').map((t: string) => t.trim()) || [],
            acceptsMarketing: customer.accepts_marketing || false,
            shopifyCreatedAt: customer.created_at ? new Date(customer.created_at) : null,
            shopifyUpdatedAt: customer.updated_at ? new Date(customer.updated_at) : null
          },
          create: {
            tenantId: this.tenantId,
            shopifyCustomerId: customer.id.toString(),
            email: customer.email,
            firstName: customer.first_name,
            lastName: customer.last_name,
            phone: customer.phone,
            ordersCount: customer.orders_count || 0,
            totalSpent: parseFloat(customer.total_spent || '0'),
            currency: customer.currency || 'USD',
            tags: customer.tags?.split(',').map((t: string) => t.trim()) || [],
            acceptsMarketing: customer.accepts_marketing || false,
            shopifyCreatedAt: customer.created_at ? new Date(customer.created_at) : null,
            shopifyUpdatedAt: customer.updated_at ? new Date(customer.updated_at) : null
          }
        });
        count++;
      }

      await this.completeSyncLog(log.id, SyncStatus.COMPLETED, count);
      return count;
    } catch (error: any) {
      await this.completeSyncLog(log.id, SyncStatus.FAILED, count, error.message);
      throw error;
    }
  }

  // ============ SYNC PRODUCTS ============
  async syncProducts(): Promise<number> {
    const log = await this.createSyncLog(SyncType.PRODUCTS);
    let count = 0;

    try {
      const products = await this.shopifyClient.getAllProducts();

      for (const product of products) {
        const firstVariant = product.variants?.[0];
        
        await prisma.product.upsert({
          where: {
            tenantId_shopifyProductId: {
              tenantId: this.tenantId,
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
            tenantId: this.tenantId,
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
        count++;
      }

      await this.completeSyncLog(log.id, SyncStatus.COMPLETED, count);
      return count;
    } catch (error: any) {
      await this.completeSyncLog(log.id, SyncStatus.FAILED, count, error.message);
      throw error;
    }
  }

  // ============ SYNC ORDERS ============
  async syncOrders(): Promise<number> {
    const log = await this.createSyncLog(SyncType.ORDERS);
    let count = 0;

    try {
      const orders = await this.shopifyClient.getAllOrders();

      for (const order of orders) {
        // Find or create customer reference
        let customerId: string | null = null;
        if (order.customer?.id) {
          const customer = await prisma.customer.findUnique({
            where: {
              tenantId_shopifyCustomerId: {
                tenantId: this.tenantId,
                shopifyCustomerId: order.customer.id.toString()
              }
            }
          });
          customerId = customer?.id || null;
        }

        // Upsert order
        const dbOrder = await prisma.order.upsert({
          where: {
            tenantId_shopifyOrderId: {
              tenantId: this.tenantId,
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
            totalShipping: order.total_shipping_price_set?.shop_money?.amount 
              ? parseFloat(order.total_shipping_price_set.shop_money.amount) : null,
            currency: order.currency || 'USD',
            note: order.note,
            tags: order.tags?.split(',').map((t: string) => t.trim()) || [],
            cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
            cancelReason: order.cancel_reason,
            shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
            shopifyUpdatedAt: order.updated_at ? new Date(order.updated_at) : null,
            processedAt: order.processed_at ? new Date(order.processed_at) : null,
            customerId
          },
          create: {
            tenantId: this.tenantId,
            shopifyOrderId: order.id.toString(),
            orderNumber: order.order_number?.toString(),
            email: order.email,
            financialStatus: order.financial_status,
            fulfillmentStatus: order.fulfillment_status,
            totalPrice: parseFloat(order.total_price || '0'),
            subtotalPrice: order.subtotal_price ? parseFloat(order.subtotal_price) : null,
            totalTax: order.total_tax ? parseFloat(order.total_tax) : null,
            totalDiscounts: order.total_discounts ? parseFloat(order.total_discounts) : null,
            totalShipping: order.total_shipping_price_set?.shop_money?.amount 
              ? parseFloat(order.total_shipping_price_set.shop_money.amount) : null,
            currency: order.currency || 'USD',
            note: order.note,
            tags: order.tags?.split(',').map((t: string) => t.trim()) || [],
            cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
            cancelReason: order.cancel_reason,
            shopifyCreatedAt: order.created_at ? new Date(order.created_at) : null,
            shopifyUpdatedAt: order.updated_at ? new Date(order.updated_at) : null,
            processedAt: order.processed_at ? new Date(order.processed_at) : null,
            customerId
          }
        });

        // Sync order line items
        if (order.line_items && order.line_items.length > 0) {
          // Delete existing line items
          await prisma.orderItem.deleteMany({
            where: { orderId: dbOrder.id }
          });

          // Create new line items
          for (const item of order.line_items) {
            // Find product reference
            let productId: string | null = null;
            if (item.product_id) {
              const product = await prisma.product.findUnique({
                where: {
                  tenantId_shopifyProductId: {
                    tenantId: this.tenantId,
                    shopifyProductId: item.product_id.toString()
                  }
                }
              });
              productId = product?.id || null;
            }

            await prisma.orderItem.create({
              data: {
                orderId: dbOrder.id,
                shopifyLineItemId: item.id.toString(),
                title: item.title,
                quantity: item.quantity,
                price: parseFloat(item.price || '0'),
                totalDiscount: item.total_discount ? parseFloat(item.total_discount) : 0,
                sku: item.sku,
                variantTitle: item.variant_title,
                productId
              }
            });
          }
        }

        count++;
      }

      await this.completeSyncLog(log.id, SyncStatus.COMPLETED, count);
      return count;
    } catch (error: any) {
      await this.completeSyncLog(log.id, SyncStatus.FAILED, count, error.message);
      throw error;
    }
  }

  // ============ SYNC ABANDONED CARTS ============
  async syncAbandonedCarts(): Promise<number> {
    let count = 0;

    try {
      const checkouts = await this.shopifyClient.getAbandonedCheckouts();

      for (const checkout of checkouts) {
        // Find customer reference
        let customerId: string | null = null;
        if (checkout.customer?.id) {
          const customer = await prisma.customer.findUnique({
            where: {
              tenantId_shopifyCustomerId: {
                tenantId: this.tenantId,
                shopifyCustomerId: checkout.customer.id.toString()
              }
            }
          });
          customerId = customer?.id || null;
        }

        await prisma.abandonedCart.upsert({
          where: {
            tenantId_shopifyCheckoutId: {
              tenantId: this.tenantId,
              shopifyCheckoutId: checkout.id.toString()
            }
          },
          update: {
            shopifyCartToken: checkout.cart_token,
            email: checkout.email,
            totalPrice: checkout.total_price ? parseFloat(checkout.total_price) : null,
            currency: checkout.currency || 'USD',
            itemCount: checkout.line_items?.length || 0,
            cartItems: checkout.line_items || null,
            checkoutStartedAt: checkout.created_at ? new Date(checkout.created_at) : null,
            abandonedAt: checkout.abandoned_checkout_url ? new Date() : null,
            customerId
          },
          create: {
            tenantId: this.tenantId,
            shopifyCheckoutId: checkout.id.toString(),
            shopifyCartToken: checkout.cart_token,
            email: checkout.email,
            totalPrice: checkout.total_price ? parseFloat(checkout.total_price) : null,
            currency: checkout.currency || 'USD',
            itemCount: checkout.line_items?.length || 0,
            cartItems: checkout.line_items || null,
            checkoutStartedAt: checkout.created_at ? new Date(checkout.created_at) : null,
            abandonedAt: new Date(),
            customerId
          }
        });
        count++;
      }

      return count;
    } catch (error: any) {
      console.error('Error syncing abandoned carts:', error.message);
      throw error;
    }
  }

  // ============ FULL SYNC ============
  async fullSync(): Promise<{ customers: number; products: number; orders: number; abandonedCarts: number }> {
    const log = await this.createSyncLog(SyncType.FULL);

    try {
      // Sync in order: Products first (for references), then Customers, Orders, Abandoned Carts
      const products = await this.syncProducts();
      const customers = await this.syncCustomers();
      const orders = await this.syncOrders();
      const abandonedCarts = await this.syncAbandonedCarts();

      // Update tenant last sync time
      await prisma.tenant.update({
        where: { id: this.tenantId },
        data: { lastSyncAt: new Date() }
      });

      const totalRecords = products + customers + orders + abandonedCarts;
      await this.completeSyncLog(log.id, SyncStatus.COMPLETED, totalRecords);

      return { customers, products, orders, abandonedCarts };
    } catch (error: any) {
      await this.completeSyncLog(log.id, SyncStatus.FAILED, 0, error.message);
      throw error;
    }
  }

  // ============ INCREMENTAL SYNC ============
  async incrementalSync(): Promise<{ customers: number; products: number; orders: number; abandonedCarts: number }> {
    const log = await this.createSyncLog(SyncType.INCREMENTAL);

    try {
      // Incremental sync fetches only recent data
      // For now, it's similar to full sync but can be optimized to only fetch updated_at > lastSyncAt
      const products = await this.syncProducts();
      const customers = await this.syncCustomers();
      const orders = await this.syncOrders();
      const abandonedCarts = await this.syncAbandonedCarts();

      // Update tenant last sync time
      await prisma.tenant.update({
        where: { id: this.tenantId },
        data: { lastSyncAt: new Date() }
      });

      const totalRecords = products + customers + orders + abandonedCarts;
      await this.completeSyncLog(log.id, SyncStatus.COMPLETED, totalRecords);

      return { customers, products, orders, abandonedCarts };
    } catch (error: any) {
      await this.completeSyncLog(log.id, SyncStatus.FAILED, 0, error.message);
      throw error;
    }
  }
}

export default DataSyncService;
