/** @type {import('next').NextConfig} */
// Set IS_PRODUCTION=true in Vercel environment variables for production.
// Leave unset or false for local development.
const isProduction = process.env.IS_PRODUCTION === "true"
const backendUrl   = isProduction
  ? (process.env.BACKEND_URL ?? "http://localhost:5000")
  : "http://localhost:5000"

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/9.x/**",
      },
    ],
  },
};

export default nextConfig;
