import axios from 'axios';
import crypto from 'crypto';

const SHOPIFY_API_VERSION = '2024-01';

interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
}

export class ShopifyClient {
  private shopDomain: string;
  private accessToken: string;
  private baseUrl: string;

  constructor(config: ShopifyConfig) {
    this.shopDomain = config.shopDomain;
    this.accessToken = config.accessToken;
    this.baseUrl = `https://${this.shopDomain}/admin/api/${SHOPIFY_API_VERSION}`;
  }

  private async request(endpoint: string, method = 'GET', data?: any) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        data
      });
      return response.data;
    } catch (error: any) {
      console.error(`Shopify API Error: ${endpoint}`, error.response?.data || error.message);
      throw error;
    }
  }

  // ============ CUSTOMERS ============
  async getCustomers(params: { limit?: number; since_id?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.since_id) queryParams.append('since_id', params.since_id);
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/customers.json${query}`);
  }

  async getAllCustomers() {
    const allCustomers: any[] = [];
    let sinceId: string | undefined;

    while (true) {
      const response = await this.getCustomers({ limit: 250, since_id: sinceId });
      const customers = response.customers;
      
      if (!customers || customers.length === 0) break;
      
      allCustomers.push(...customers);
      sinceId = customers[customers.length - 1].id.toString();

      // Rate limiting
      await this.sleep(500);
    }

    return allCustomers;
  }

  async getCustomer(customerId: string) {
    return this.request(`/customers/${customerId}.json`);
  }

  // ============ ORDERS ============
  async getOrders(params: { limit?: number; since_id?: string; status?: string; created_at_min?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.since_id) queryParams.append('since_id', params.since_id);
    if (params.status) queryParams.append('status', params.status);
    if (params.created_at_min) queryParams.append('created_at_min', params.created_at_min);
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/orders.json${query}`);
  }

  async getAllOrders(createdAtMin?: string) {
    const allOrders: any[] = [];
    let sinceId: string | undefined;

    while (true) {
      const response = await this.getOrders({ 
        limit: 250, 
        since_id: sinceId, 
        status: 'any',
        created_at_min: createdAtMin
      });
      const orders = response.orders;
      
      if (!orders || orders.length === 0) break;
      
      allOrders.push(...orders);
      sinceId = orders[orders.length - 1].id.toString();

      // Rate limiting
      await this.sleep(500);
    }

    return allOrders;
  }

  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}.json`);
  }

  // ============ PRODUCTS ============
  async getProducts(params: { limit?: number; since_id?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.since_id) queryParams.append('since_id', params.since_id);
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/products.json${query}`);
  }

  async getAllProducts() {
    const allProducts: any[] = [];
    let sinceId: string | undefined;

    while (true) {
      const response = await this.getProducts({ limit: 250, since_id: sinceId });
      const products = response.products;
      
      if (!products || products.length === 0) break;
      
      allProducts.push(...products);
      sinceId = products[products.length - 1].id.toString();

      // Rate limiting
      await this.sleep(500);
    }

    return allProducts;
  }

  async getProduct(productId: string) {
    return this.request(`/products/${productId}.json`);
  }

  // ============ CHECKOUTS (Abandoned Carts) ============
  async getCheckouts(params: { limit?: number; since_id?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.since_id) queryParams.append('since_id', params.since_id);
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.request(`/checkouts.json${query}`);
  }

  async getAbandonedCheckouts() {
    const allCheckouts: any[] = [];
    let sinceId: string | undefined;

    while (true) {
      const response = await this.getCheckouts({ limit: 250, since_id: sinceId });
      const checkouts = response.checkouts;
      
      if (!checkouts || checkouts.length === 0) break;
      
      // Filter for abandoned (not completed)
      const abandoned = checkouts.filter((c: any) => !c.completed_at);
      allCheckouts.push(...abandoned);
      
      sinceId = checkouts[checkouts.length - 1].id.toString();

      // Rate limiting
      await this.sleep(500);
    }

    return allCheckouts;
  }

  // ============ SHOP INFO ============
  async getShop() {
    return this.request('/shop.json');
  }

  // ============ WEBHOOKS ============
  async createWebhook(topic: string, address: string) {
    return this.request('/webhooks.json', 'POST', {
      webhook: {
        topic,
        address,
        format: 'json'
      }
    });
  }

  async getWebhooks() {
    return this.request('/webhooks.json');
  }

  async deleteWebhook(webhookId: string) {
    return this.request(`/webhooks/${webhookId}.json`, 'DELETE');
  }

  // ============ UTILITIES ============
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Verify webhook signature
  static verifyWebhook(data: string, hmacHeader: string, secret: string): boolean {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(data, 'utf8')
      .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  }
}

// OAuth Helper Functions
export const shopifyOAuth = {
  generateAuthUrl(shop: string, redirectUri: string, state: string): string {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const scopes = process.env.SHOPIFY_SCOPES || 'read_customers,read_orders,read_products';
    
    return `https://${shop}/admin/oauth/authorize?` +
      `client_id=${apiKey}&` +
      `scope=${scopes}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;
  },

  async exchangeCodeForToken(shop: string, code: string): Promise<string> {
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code
    });
    return response.data.access_token;
  },

  verifyHmac(query: Record<string, string>): boolean {
    const { hmac, ...rest } = query;
    const message = Object.keys(rest)
      .sort()
      .map(key => `${key}=${rest[key]}`)
      .join('&');
    
    const generatedHash = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET || '')
      .update(message)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(generatedHash),
      Buffer.from(hmac || '')
    );
  }
};

export default ShopifyClient;
