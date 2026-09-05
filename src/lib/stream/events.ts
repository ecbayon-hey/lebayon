export type Source = { type: "klarna" | "eddy" | "web"; title: string; heading?: string; url: string };
export type ChartArtifact = { type: "line"|"bar"|"area"|"pie"|"donut"; title: string; labels: string[]; series: { name:string; data:number[] }[]; xAxisLabel?:string; yAxisLabel?:string };
export type StreamEvent =
 | { type:"conversation_started" }
 | { type:"text_delta"; delta:string }
 | { type:"tool_started"; tool:string; label:string }
 | { type:"tool_finished"; tool:string }
 | { type:"source"; source:Source }
 | { type:"image"; url:string; alt:string }
 | { type:"chart"; chart:ChartArtifact }
 | { type:"summary_update"; summary:string }
 | { type:"error"; message:string }
 | { type:"done" };
