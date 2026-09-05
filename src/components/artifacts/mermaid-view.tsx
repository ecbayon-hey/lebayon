"use client";
import { useEffect, useId, useState } from "react";
export function MermaidView({code}:{code:string}) { const id=useId().replace(/:/g,""); const [svg,setSvg]=useState(""); const [error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{const mermaid=(await import("mermaid")).default;mermaid.initialize({startOnLoad:false,securityLevel:"strict",theme:"base",themeVariables:{primaryColor:"#faf7ef",primaryTextColor:"#142a3a",lineColor:"#5e9273",fontFamily:"system-ui"}});const out=await mermaid.render(`m${id}`,code);if(active)setSvg(out.svg)}catch{if(active)setError("This diagram couldn't be rendered.")}})();return()=>{active=false}},[code,id]);
 if(error)return <div className="diagram error">{error}</div>; return <div className="diagram" aria-label="Diagram" dangerouslySetInnerHTML={{__html:svg}}/> }
