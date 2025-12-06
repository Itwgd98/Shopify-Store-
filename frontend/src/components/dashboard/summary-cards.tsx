"use client";

import { formatCurrency, formatNumber } from "@/lib/utils";
import { Users, ShoppingCart, DollarSign, Package, TrendingUp, TrendingDown } from "lucide-react";

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

interface Props {
  data: SummaryData;
}

export default function SummaryCards({ data }: Props) {
  const cards = [
    {
      title: "Total Revenue",
      value: formatCurrency(data.totalRevenue),
      change: data.trends.revenue.percentChange,
      icon: DollarSign,
      color: "green",
    },
    {
      title: "Total Orders",
      value: formatNumber(data.totalOrders),
      change: data.trends.orders.percentChange,
      icon: ShoppingCart,
      color: "blue",
    },
    {
      title: "Total Customers",
      value: formatNumber(data.totalCustomers),
      icon: Users,
      color: "purple",
    },
    {
      title: "Total Products",
      value: formatNumber(data.totalProducts),
      icon: Package,
      color: "orange",
    },
  ];

  const colorClasses: Record<string, { bg: string; text: string; iconBg: string }> = {
    green: { bg: "bg-green-50", text: "text-green-600", iconBg: "bg-green-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-blue-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", iconBg: "bg-purple-100" },
    orange: { bg: "bg-orange-50", text: "text-orange-600", iconBg: "bg-orange-100" },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const colors = colorClasses[card.color];
        return (
          <div
            key={index}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                {card.change !== undefined && (
                  <div className="flex items-center gap-1 mt-2">
                    {card.change >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        card.change >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {card.change >= 0 ? "+" : ""}
                      {card.change.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-500">vs last period</span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-xl ${colors.iconBg}`}>
                <card.icon className={`w-6 h-6 ${colors.text}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
