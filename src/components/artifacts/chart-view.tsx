"use client";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { ChartArtifact } from "@/lib/stream/events";
const colors=["#5e9273","#8273a9","#d2a441","#bf6464"];
export function ChartView({chart}:{chart:ChartArtifact}) { const data=chart.labels.map((label,i)=>Object.fromEntries([["label",label],...chart.series.map(s=>[s.name,s.data[i]??0])]));
 return <figure className="chart-card"><figcaption><strong>{chart.title}</strong></figcaption><ResponsiveContainer width="100%" height="90%">
  {chart.type==="pie"||chart.type==="donut"?<PieChart><Pie data={data} dataKey={chart.series[0]?.name} nameKey="label" innerRadius={chart.type==="donut"?55:0}>{data.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Tooltip/><Legend/></PieChart>:
  chart.type==="bar"?<BarChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="label"/><YAxis/><Tooltip/><Legend/>{chart.series.map((s,i)=><Bar key={s.name} dataKey={s.name} fill={colors[i%colors.length]} radius={[6,6,0,0]}/>)}</BarChart>:
  chart.type==="area"?<AreaChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="label"/><YAxis/><Tooltip/><Legend/>{chart.series.map((s,i)=><Area key={s.name} dataKey={s.name} stroke={colors[i%colors.length]} fill={colors[i%colors.length]} fillOpacity={.2}/>)}</AreaChart>:
  <LineChart data={data}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="label"/><YAxis/><Tooltip/><Legend/>{chart.series.map((s,i)=><Line key={s.name} dataKey={s.name} stroke={colors[i%colors.length]} strokeWidth={2}/>)}</LineChart>}
 </ResponsiveContainer></figure> }
