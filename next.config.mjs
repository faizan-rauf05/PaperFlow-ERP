/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/auth/login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/auth/forgot-password",
        destination: "/forgot-password",
        permanent: false,
      },
      {
        source: "/auth/setup-password",
        destination: "/setup-password",
        permanent: false,
      },
      {
        source: "/auth/reset-password",
        destination: "/reset-password",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
