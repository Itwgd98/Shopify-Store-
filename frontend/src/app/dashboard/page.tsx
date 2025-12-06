"use client";

import { useState, useEffect } from "react";
import { analyticsApi } from "@/lib/api";
import SummaryCards from "@/components/dashboard/summary-cards";
import RevenueChart from "@/components/dashboard/revenue-chart";
import OrdersChart from "@/components/dashboard/orders-chart";
import TopCustomers from "@/components/dashboard/top-customers";
import TopProducts from "@/components/dashboard/top-products";
import OrderStatusChart from "@/components/dashboard/order-status-chart";
import AbandonedCartsCard from "@/components/dashboard/abandoned-carts-card";
import DateRangeFilter from "@/components/dashboard/date-range-filter";
import { Loader2 } from "lucide-react";

interface SummaryData {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  trends: {
    revenue: { current: number; previous: number; percentChange: number };
    orders: { current: number; previous: number; percentChange: number };
  };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [ordersByDate, setOrdersByDate] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<any>(null);
  const [abandonedCarts, setAbandonedCarts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ days: 30 });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        summaryRes,
        revenueRes,
        ordersRes,
        customersRes,
        productsRes,
        statusRes,
        cartsRes,
      ] = await Promise.all([
        analyticsApi.getSummary(),
        analyticsApi.getRevenueTrend(dateRange.days),
        analyticsApi.getOrdersByDate(),
        analyticsApi.getTopCustomers(5),
        analyticsApi.getTopProducts(5),
        analyticsApi.getOrderStatus(),
        analyticsApi.getAbandonedCarts(),
      ]);

      setSummary(summaryRes.data);
      setRevenueTrend(revenueRes.data);
      setOrdersByDate(ordersRes.data.orders);
      setTopCustomers(customersRes.data);
      setTopProducts(productsRes.data);
      setOrderStatus(statusRes.data);
      setAbandonedCarts(cartsRes.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome to your Shopify analytics overview</p>
        </div>
        <DateRangeFilter
          value={dateRange.days}
          onChange={(days) => setDateRange({ days })}
        />
      </div>

      {/* Summary Cards */}
      {summary && <SummaryCards data={summary} />}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueTrend} />
        <OrdersChart data={ordersByDate} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopCustomers data={topCustomers} />
        <TopProducts data={topProducts} />
        <div className="space-y-6">
          {orderStatus && <OrderStatusChart data={orderStatus} />}
          {abandonedCarts && <AbandonedCartsCard data={abandonedCarts} />}
        </div>
      </div>
    </div>
  );
}
