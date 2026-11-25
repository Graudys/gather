"use client";
import { useEffect, useRef } from "react";

/** Ao abrir o calendário, rola até a hora certa (7h ou o primeiro evento). */
export function ScrollToHour({ hour, px }: { hour: number; px: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current?.closest("[data-cal-scroll]");
    if (box) box.scrollTop = Math.max(hour * px - 8, 0);
  }, [hour, px]);
  return <span ref={ref} hidden />;
}
