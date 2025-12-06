"use client";

import { formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface Product {
  productId: string;
  title: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface Props {
  data: Product[];
}

export default function TopProducts({ data }: Props) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-semibold text-gray-900">Top Products</h3>
      </div>

      <div className="space-y-4">
        {data.map((product, index) => (
          <div
            key={product.productId}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{product.title}</p>
              <p className="text-sm text-gray-500">{product.totalQuantity} units sold</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(product.totalRevenue)}
              </p>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <p className="text-center text-gray-500 py-8">No products yet</p>
        )}
      </div>
    </div>
  );
}
