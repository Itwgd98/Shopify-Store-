"use client";

import { formatCurrency } from "@/lib/utils";
import { Crown } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string;
  totalSpent: number;
  ordersCount: number;
}

interface Props {
  data: Customer[];
}

export default function TopCustomers({ data }: Props) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-6">
        <Crown className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
      </div>

      <div className="space-y-4">
        {data.map((customer, index) => (
          <div
            key={customer.id}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                index === 0
                  ? "bg-yellow-500"
                  : index === 1
                  ? "bg-gray-400"
                  : index === 2
                  ? "bg-amber-600"
                  : "bg-gray-300"
              }`}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{customer.name}</p>
              <p className="text-sm text-gray-500 truncate">{customer.email}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(customer.totalSpent)}
              </p>
              <p className="text-xs text-gray-500">{customer.ordersCount} orders</p>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <p className="text-center text-gray-500 py-8">No customers yet</p>
        )}
      </div>
    </div>
  );
}
