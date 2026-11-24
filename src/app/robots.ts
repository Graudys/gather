import type { MetadataRoute } from "next";

// App fechado: nada aqui precisa aparecer em buscador.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
