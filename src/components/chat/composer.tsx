"use client";

import { FormEvent, useEffect, useState } from "react";
import { Mic, Send, X } from "lucide-react";
import { Waveform } from "./waveform";
import { useTranscription } from "./use-transcription";

export function Composer({ onSend, disabled, resetKey }: {
  onSend: (value: string) => void;
  disabled: boolean;
  resetKey: number;
}) {
  const [text, setText] = useState("");
  const voice = useTranscription(text, setText);
  const active = voice.state === "recording" || voice.state === "transcribing";

  useEffect(() => {
    setText("");
    voice.reset();
    // resetKey intentionally owns this lifecycle; voice.reset is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  };

  return <div className="composer-wrap"><form className="composer" onSubmit={submit}>
    {active ? <div className="voice">
      <span className="record-label" role="status">
        {voice.state === "recording" ? `Recording ${Math.floor(voice.elapsed / 60)}:${String(voice.elapsed % 60).padStart(2, "0")}` : "Transcribing…"}
      </span>
      <Waveform analyser={voice.analyser} />
      <button type="button" className="cancel" onClick={voice.cancel} aria-label="Cancel recording"><X /></button>
      <button type="button" className="stop" onClick={voice.stop} disabled={voice.state !== "recording"}>Stop</button>
    </div> : <div className="compose-row">
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Ask about Klarna Network…" aria-label="Message LeBayon" rows={1} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(event); } }} />
      <button type="button" className="mic" onClick={voice.start} aria-label="Start voice transcription"><Mic size={20} /></button>
      <button className="send" disabled={!text.trim() || disabled} aria-label="Send message"><Send size={19} /></button>
    </div>}
    {voice.error && <div className="error" role="alert">{voice.error}</div>}
    <p className="privacy">Chats live only in this session and aren&apos;t stored by LeBayon.</p>
  </form></div>;
}
