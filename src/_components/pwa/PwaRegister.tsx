"use client";
import { useEffect } from "react";
import { registerSw } from "./sw";

/** Registra o service worker em qualquer página (fica no layout raiz). */
export function PwaRegister() {
  useEffect(() => {
    const go = () => void registerSw();
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
