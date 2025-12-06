"use client";

import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, AlertTriangle } from "lucide-react";

interface AbandonedCartData {
  total: number;
  recovered: number;
  recoveryRate: number;
  potentialRevenue: number;
}

interface Props {
  data: AbandonedCartData;
}

export default function AbandonedCartsCard({ data }: Props) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-gray-900">Abandoned Carts</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Abandoned</span>
          <span className="font-semibold text-gray-900">{data.total}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Recovered</span>
          <span className="font-semibold text-green-600">{data.recovered}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Recovery Rate</span>
          <span className="font-semibold text-gray-900">{data.recoveryRate}%</span>
        </div>
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Potential Revenue</span>
            <span className="font-semibold text-orange-600">
              {formatCurrency(data.potentialRevenue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
