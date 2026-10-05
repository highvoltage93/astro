import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@astroprocessor/consultation-format"],
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? {
    output: "standalone",
    experimental: { outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)) }
  } : {})
};

export default nextConfig;
