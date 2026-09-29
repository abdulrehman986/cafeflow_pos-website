"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { format } from "date-fns";

const METHOD_COLORS: Record<string, string> = {
  CASH: "#059669",
  CARD: "#d97706",
  MOBILE: "#0d9488",
  OTHER: "#a1a1aa",
};

export function SalesTrendChart({
  data,
  currencyPrefix = "Rs.",
}: {
  data: Array<{ date: string; total: number }>;
  currencyPrefix?: string;
}) {
  const points = data.map((d) => ({
    ...d,
    label: format(new Date(d.date + "T00:00:00"), "d MMM"),
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <Tooltip
            formatter={(value: number | string) => [`${currencyPrefix} ${Number(value).toLocaleString("en-PK")}`, "Sales"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e4e4e7", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} fill="url(#salesFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentMethodChart({
  data,
}: {
  data: Array<{ method: string; total: number; count: number }>;
}) {
  if (!data.length) {
    return (
      <div className="h-72 grid place-items-center text-sm text-muted-foreground">
        No payment data yet
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis
            dataKey="method"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(m: string) => m.charAt(0) + m.slice(1).toLowerCase()}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <Tooltip
            formatter={(value: number | string, _name, item: { payload?: { count?: number } }) => [
              `Rs. ${Number(value).toLocaleString("en-PK")}${item?.payload?.count ? ` (${item.payload.count} orders)` : ""}`,
              "Revenue",
            ]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e4e4e7", fontSize: 12 }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.method} fill={METHOD_COLORS[d.method] ?? "#a1a1aa"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
