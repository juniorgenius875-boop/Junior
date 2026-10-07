/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow access to the dev server from your LAN IP.
  allowedDevOrigins: [
    '192.168.0.159',
    'localhost',
  ],
};

export default nextConfig;