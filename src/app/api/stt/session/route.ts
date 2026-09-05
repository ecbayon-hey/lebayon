import {createRealtimeSession} from "@/lib/stt/mistral";
export const runtime="nodejs";
export async function POST(req:Request){if(Number(req.headers.get("content-length")||0)>1024)return Response.json({error:"Invalid request"},{status:413});try{return Response.json(await createRealtimeSession(),{headers:{"Cache-Control":"no-store"}})}catch(error){console.error("STT session failed",error);return Response.json({error:"Voice transcription is unavailable right now."},{status:502})}}
