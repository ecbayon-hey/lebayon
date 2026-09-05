"use client";

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { ChartArtifact } from "@/lib/stream/events";

const colors = ["#5e9273", "#8273a9", "#d2a441", "#bf6464"];

export function ChartView({ chart }: { chart: ChartArtifact }) {
  const data = chart.labels.map((label, index) => Object.fromEntries([
    ["label", label],
    ...chart.series.map((series) => [series.name, series.data[index] ?? 0]),
  ]));

  return (
    <figure className="chart-card">
      <figcaption><strong>{chart.title}</strong></figcaption>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "pie" || chart.type === "donut" ? (
            <PieChart><Pie data={data} dataKey={chart.series[0]?.name} nameKey="label" innerRadius={chart.type === "donut" ? 55 : 0}>{data.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
          ) : chart.type === "bar" ? (
            <BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend />{chart.series.map((series, index) => <Bar key={series.name} dataKey={series.name} fill={colors[index % colors.length]} radius={[6, 6, 0, 0]} />)}</BarChart>
          ) : chart.type === "area" ? (
            <AreaChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend />{chart.series.map((series, index) => <Area key={series.name} dataKey={series.name} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={0.2} />)}</AreaChart>
          ) : (
            <LineChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={0.2} /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend />{chart.series.map((series, index) => <Line key={series.name} dataKey={series.name} stroke={colors[index % colors.length]} strokeWidth={2} />)}</LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
