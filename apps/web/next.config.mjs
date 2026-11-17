import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@astroprocessor/consultation-format"],
  async headers() {
    return ["/forgot-password", "/reset-password"].map((source) => ({ source, headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" }
    ] }));
  },
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? {
    output: "standalone",
    experimental: { outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)) }
  } : {})
};

export default nextConfig;
