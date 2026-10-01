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

/*
 * All chart colors resolve through CSS custom properties (chart-1..5,
 * border, muted-foreground, popover) so every chart re-themes instantly —
 * no re-render or remount is needed when the user toggles light/dark.
 */
const METHOD_COLORS: Record<string, string> = {
  CASH: "var(--chart-1)",
  CARD: "var(--chart-2)",
  MOBILE: "var(--chart-3)",
  OTHER: "var(--muted-foreground)",
};

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const GRID_STROKE = "var(--border)";
const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--muted-foreground)" };
const BRAND = "var(--chart-1)";

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
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.32} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <Tooltip
            formatter={(value: number | string) => [`${currencyPrefix} ${Number(value).toLocaleString("en-PK")}`, "Sales"]}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            cursor={{ stroke: BRAND, strokeOpacity: 0.25 }}
          />
          <Area type="monotone" dataKey="total" stroke={BRAND} strokeWidth={2} fill="url(#salesFill)" />
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
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="method"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(m: string) => m.charAt(0) + m.slice(1).toLowerCase()}
          />
          <YAxis
            tick={AXIS_TICK}
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
            contentStyle={TOOLTIP_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            cursor={{ fill: BRAND, fillOpacity: 0.08 }}
          />
          <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((d) => (
              <Cell key={d.method} fill={METHOD_COLORS[d.method] ?? "var(--muted-foreground)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
