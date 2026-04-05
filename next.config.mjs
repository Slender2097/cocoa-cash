/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: false,
  reactStrictMode: true,
  transpilePackages: ["@cashu/cashu-ts", "nostr-tools"],
};

export default nextConfig;
