import type { MetadataRoute } from "next";

// PWA: permite instalar o Gather no PC (Chrome/Edge) e no celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gather",
    short_name: "Gather",
    description: "Chat, tarefas, agenda e reuniões por áudio para o seu time.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#0c0c10",
    theme_color: "#0c0c10",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
