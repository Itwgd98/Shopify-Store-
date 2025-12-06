"use client";

import { useState, useEffect } from "react";
import { shopifyApi, tenantApi } from "@/lib/api";
import {
  Loader2,
  Store,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  ExternalLink,
  ShoppingBag,
  Users,
  Package,
  ShoppingCart,
  Key,
} from "lucide-react";

interface ShopifyStatus {
  isConnected: boolean;
  shopDomain: string | null;
  shopName: string | null;
  lastSyncAt: string | null;
}

interface SyncStatus {
  isConnected: boolean;
  lastSyncAt: string | null;
  latestSync: {
    id: string;
    syncType: string;
    status: string;
    recordsCount: number;
    startedAt: string;
    completedAt: string | null;
    errorMessage: string | null;
  } | null;
}

export default function ShopifyPage() {
  const [status, setStatus] = useState<ShopifyStatus | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();
    
    // Check URL params for connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get("shopify") === "connected") {
      setMessage({ type: "success", text: "Shopify store connected successfully!" });
      window.history.replaceState({}, "", "/dashboard/shopify");
    } else if (params.get("shopify") === "error") {
      setMessage({ type: "error", text: params.get("message") || "Failed to connect Shopify store" });
      window.history.replaceState({}, "", "/dashboard/shopify");
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const [statusRes, syncRes] = await Promise.all([
        shopifyApi.getStatus(),
        shopifyApi.getSyncStatus(),
      ]);
      setStatus(statusRes.data);
      setSyncStatus(syncRes.data);
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up the domain - remove https:// and trailing slashes
    let cleanDomain = shopDomain.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    
    // Add .myshopify.com if not present
    if (!cleanDomain.includes('.myshopify.com')) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    if (!cleanDomain) {
      setMessage({ type: "error", text: "Please enter your Shopify store domain" });
      return;
    }

    if (!accessToken.trim()) {
      setMessage({ type: "error", text: "Please enter your Shopify Admin API access token" });
      return;
    }

    setConnecting(true);
    setMessage(null);

    try {
      // Use direct token connection instead of OAuth
      await tenantApi.updateSettings({
        shopifyDomain: cleanDomain,
        shopifyAccessToken: accessToken.trim(),
        syncEnabled: true,
      });
      
      setMessage({ type: "success", text: "Shopify store connected! Starting data sync..." });
      
      // Trigger initial sync
      setTimeout(async () => {
        try {
          await shopifyApi.triggerSync();
          fetchStatus();
        } catch (err) {
          console.error("Sync error:", err);
        }
      }, 1000);
      
      fetchStatus();
      setShopDomain("");
      setAccessToken("");
    } catch (error: any) {
      setMessage({ 
        type: "error", 
        text: error.response?.data?.message || "Failed to connect store" 
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your Shopify store?")) {
      return;
    }

    try {
      await shopifyApi.disconnect();
      setMessage({ type: "success", text: "Shopify store disconnected" });
      fetchStatus();
    } catch (error) {
      setMessage({ type: "error", text: "Failed to disconnect store" });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);

    try {
      await shopifyApi.triggerSync();
      setMessage({ type: "success", text: "Data sync started! This may take a few minutes." });
      // Poll for sync status
      setTimeout(fetchStatus, 3000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to start sync" });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shopify Integration</h1>
        <p className="text-gray-600">Connect and sync your Shopify store data</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-3 rounded-lg ${status?.isConnected ? "bg-green-100" : "bg-gray-100"}`}>
              <Store className={`w-6 h-6 ${status?.isConnected ? "text-green-600" : "text-gray-600"}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Connection Status</h2>
              <p className={`text-sm ${status?.isConnected ? "text-green-600" : "text-gray-500"}`}>
                {status?.isConnected ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>

          {status?.isConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Store Domain</span>
                  <a
                    href={`https://${status.shopDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-600 hover:underline flex items-center gap-1"
                  >
                    {status.shopDomain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Store Name</span>
                  <span className="text-sm font-medium text-gray-900">{status.shopName || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last Sync</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(status.lastSyncAt)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sync Now
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Unlink className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shopify Store Domain
                </label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your store's .myshopify.com domain (e.g., your-store.myshopify.com)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Key className="w-4 h-4" />
                    Admin API Access Token
                  </span>
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get this from Shopify Admin → Settings → Apps → Develop apps
                </p>
              </div>

              <button
                type="submit"
                disabled={connecting}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
                Connect Store
              </button>
            </form>
          )}
        </div>

        {/* Sync Information Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Sync Information</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Customers</span>
                </div>
                <p className="text-xs text-blue-700">
                  Synced from Shopify Customer API
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Orders</span>
                </div>
                <p className="text-xs text-purple-700">
                  Synced from Shopify Order API
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Products</span>
                </div>
                <p className="text-xs text-orange-700">
                  Synced from Shopify Product API
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Abandoned Carts</span>
                </div>
                <p className="text-xs text-red-700">
                  Synced from Checkout API
                </p>
              </div>
            </div>

            {syncStatus?.latestSync && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Latest Sync</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium">{syncStatus.latestSync.syncType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-medium ${
                      syncStatus.latestSync.status === "COMPLETED" ? "text-green-600" :
                      syncStatus.latestSync.status === "FAILED" ? "text-red-600" :
                      "text-yellow-600"
                    }`}>
                      {syncStatus.latestSync.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Records</span>
                    <span className="font-medium">{syncStatus.latestSync.recordsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started</span>
                    <span className="font-medium">{formatDate(syncStatus.latestSync.startedAt)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Automatic Sync</h3>
              <p className="text-sm text-gray-600">
                Data is automatically synced every 6 hours. You can also trigger a manual sync using the "Sync Now" button.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Webhooks:</strong> Real-time updates are received for orders, customers, and products when changes occur in Shopify.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Instructions - only show when not connected */}
      {!status?.isConnected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h2>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                1
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Create a Custom App in Shopify</h3>
                <p className="text-sm text-gray-600">
                  Go to your Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                2
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Configure API Scopes</h3>
                <p className="text-sm text-gray-600">
                  Enable read_products, read_customers, read_orders scopes in Admin API configuration
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                3
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Install & Get Access Token</h3>
                <p className="text-sm text-gray-600">
                  Install the app and copy the Admin API access token (starts with shpat_)
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                4
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Connect & Sync</h3>
                <p className="text-sm text-gray-600">
                  Enter your store domain and access token above, then click "Sync Now" to import your data
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
