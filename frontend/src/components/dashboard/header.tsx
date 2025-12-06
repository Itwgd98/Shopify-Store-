"use client";

import { useAuth } from "@/lib/auth-context";
import { Menu, RefreshCw } from "lucide-react";
import { shopifyApi } from "@/lib/api";
import { toast } from "@/components/ui/toaster";
import { useState } from "react";

export default function DashboardHeader() {
  const { user, tenant } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!tenant?.isConnected) {
      toast({
        title: "Shopify not connected",
        description: "Please connect your Shopify store first",
        type: "warning",
      });
      return;
    }

    setSyncing(true);
    try {
      await shopifyApi.triggerSync();
      toast({
        title: "Sync started",
        description: "Data synchronization is running in the background",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Could not start data sync",
        type: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Mobile menu button */}
        <button className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700">
          <Menu className="w-6 h-6" />
        </button>

        {/* Right side */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Data"}
          </button>

          {/* User */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-medium text-sm">
                {user?.name?.[0] || user?.email?.[0] || "U"}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
