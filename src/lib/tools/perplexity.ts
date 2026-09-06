import "server-only";
export async function searchWeb(query:string){if(!process.env.PERPLEXITY_API_KEY)throw new Error("PERPLEXITY_API_KEY is not configured");const response=await fetch("https://api.perplexity.ai/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.PERPLEXITY_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"sonar",messages:[{role:"system",content:"Research concisely. Return factual prose with source citations."},{role:"user",content:query}]}),signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error(`Web research failed (${response.status})`);const data=await response.json();return{answer:data.choices?.[0]?.message?.content||"No result",sources:(data.citations||[]).map((url:string)=>({type:"web" as const,title:new URL(url).hostname,url}))}}

/** URL discovery only. Callers must fetch and extract the official page itself. */
export async function discoverOfficialKlarnaUrls(query: string) {
  if (!process.env.PERPLEXITY_API_KEY) return [];
  const response = await fetch("https://api.perplexity.ai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "sonar", search_domain_filter: ["docs.klarna.com"], messages: [{ role: "system", content: "Find relevant official Klarna documentation URLs. URLs are the only output used." }, { role: "user", content: query }] }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return [];
  const data = await response.json() as { citations?: string[] };
  return (data.citations ?? []).filter((value) => {
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "docs.klarna.com" && url.pathname.startsWith("/klarna-network-distribution/"); } catch { return false; }
  });
}
