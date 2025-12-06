"use client";

import { useState, useEffect } from "react";
import { tenantApi, shopifyApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Loader2,
  Save,
  RefreshCw,
  Store,
  Key,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface TenantSettings {
  id: string;
  name: string;
  shopifyDomain: string;
  shopifyAccessToken: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  customersProcessed: number;
  ordersProcessed: number;
  productsProcessed: number;
  errorMessage: string | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    shopifyDomain: "",
    shopifyAccessToken: "",
    syncEnabled: true,
  });

  useEffect(() => {
    fetchSettings();
    fetchSyncLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await tenantApi.getSettings();
      setSettings(response.data);
      setFormData({
        name: response.data.name || "",
        shopifyDomain: response.data.shopifyDomain || "",
        shopifyAccessToken: response.data.shopifyAccessToken || "",
        syncEnabled: response.data.syncEnabled ?? true,
      });
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const response = await shopifyApi.getSyncHistory(1, 5);
      setSyncLogs(response.data.logs);
    } catch (error) {
      console.error("Failed to fetch sync logs:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await tenantApi.updateSettings(formData);
      setMessage({ type: "success", text: "Settings saved successfully!" });
      fetchSettings();
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (type: "full" | "incremental") => {
    setSyncing(true);
    setMessage(null);

    try {
      if (type === "full") {
        await shopifyApi.triggerFullSync();
      } else {
        await shopifyApi.triggerIncrementalSync();
      }
      setMessage({ type: "success", text: `${type === "full" ? "Full" : "Incremental"} sync started!` });
      setTimeout(fetchSyncLogs, 2000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to start sync. Please try again." });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "in_progress":
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your tenant and Shopify integration settings</p>
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
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Tenant Settings</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="My Store"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shopify Domain
              </label>
              <input
                type="text"
                value={formData.shopifyDomain}
                onChange={(e) => setFormData({ ...formData, shopifyDomain: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="mystore.myshopify.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Shopify store domain (e.g., store-name.myshopify.com)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  <Key className="w-4 h-4" />
                  Access Token
                </span>
              </label>
              <input
                type="password"
                value={formData.shopifyAccessToken}
                onChange={(e) =>
                  setFormData({ ...formData, shopifyAccessToken: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="••••••••••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your Shopify Admin API access token
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="syncEnabled"
                checked={formData.syncEnabled}
                onChange={(e) => setFormData({ ...formData, syncEnabled: e.target.checked })}
                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <label htmlFor="syncEnabled" className="text-sm text-gray-700">
                Enable automatic sync
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Settings
            </button>
          </form>
        </div>

        {/* Sync Controls */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Data Sync</h2>
            </div>

            {settings?.lastSyncAt && (
              <p className="text-sm text-gray-600 mb-4">
                Last sync: {formatDate(settings.lastSyncAt)}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleSync("incremental")}
                disabled={syncing}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Incremental Sync
              </button>
              <button
                onClick={() => handleSync("full")}
                disabled={syncing}
                className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Full Sync
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Incremental sync fetches only new/updated data. Full sync re-imports all data.
            </p>
          </div>

          {/* Sync History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Sync History</h2>
            </div>

            {syncLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No sync history available</p>
            ) : (
              <div className="space-y-3">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {log.syncType} sync
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(log.startedAt)}
                      </p>
                      {log.status === "COMPLETED" && (
                        <p className="text-xs text-gray-600 mt-1">
                          {log.customersProcessed} customers, {log.ordersProcessed} orders,{" "}
                          {log.productsProcessed} products
                        </p>
                      )}
                      {log.errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
