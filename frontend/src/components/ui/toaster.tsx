"use client";

import { useEffect } from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "error" | "warning" | "info";
}

// Simple toast implementation
let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function toast(options: Omit<Toast, "id">) {
  const id = Math.random().toString(36).substring(7);
  const newToast = { ...options, id };
  toasts.push(newToast);
  notify();

  // Auto remove after 5 seconds
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 5000);

  return id;
}

export function Toaster() {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <ToastContainer />
    </div>
  );
}

function ToastContainer() {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setToastList(newToasts);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <>
      {toastList.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg max-w-sm animate-slide-in ${
            t.type === "error"
              ? "bg-red-500 text-white"
              : t.type === "success"
              ? "bg-green-500 text-white"
              : t.type === "warning"
              ? "bg-yellow-500 text-white"
              : "bg-gray-800 text-white"
          }`}
        >
          <p className="font-medium">{t.title}</p>
          {t.description && (
            <p className="text-sm opacity-90">{t.description}</p>
          )}
        </div>
      ))}
    </>
  );
}

import { useState } from "react";
