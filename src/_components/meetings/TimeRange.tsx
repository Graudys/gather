"use client";
import { useState } from "react";
import s from "@/_styles/chat/Panel.module.css";

const SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dur = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m / 60}h`);

/**
 * Início e fim do evento. O fim só oferece horários depois do início (no
 * mesmo dia) e, ao mudar o início, anda junto mantendo a duração.
 */
export function TimeRange({ start: start0, end: end0 }: { start: string; end: string }) {
  // Horários fora da grade de 15 min (eventos antigos) entram na lista também.
  const [start, setStart] = useState(start0);
  const [end, setEnd] = useState(toMin(end0) > toMin(start0) ? end0 : toTime(Math.min(toMin(start0) + 30, 23 * 60 + 59)));
  const startOpts = [...new Set([...SLOTS, start0])].sort();
  const endOpts = [...new Set([...SLOTS.map((t) => t), "23:59", end])].filter((t) => toMin(t) > toMin(start)).sort();

  return (
    <>
      <label className={s.label}>
        Início
        <select
          name="start"
          className={s.select}
          value={start}
          onChange={(e) => {
            const next = e.currentTarget.value;
            const length = Math.max(toMin(end) - toMin(start), 15);
            setStart(next);
            setEnd(toTime(Math.min(toMin(next) + length, 23 * 60 + 59)));
          }}
        >
          {startOpts.filter((t) => t !== "23:59").map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className={s.label}>
        Fim
        <select name="end" className={s.select} value={end} onChange={(e) => setEnd(e.currentTarget.value)}>
          {endOpts.map((t) => <option key={t} value={t}>{t} ({dur(toMin(t) - toMin(start))})</option>)}
        </select>
      </label>
    </>
  );
}
