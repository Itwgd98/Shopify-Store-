"use client";

import { Calendar } from "lucide-react";

interface Props {
  value: number;
  onChange: (days: number) => void;
}

export default function DateRangeFilter({ value, onChange }: Props) {
  const options = [
    { label: "7 days", value: 7 },
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
  ];

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-500" />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            Last {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
