/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Only needed if a component switches to next/image for remote photos; the app currently uses plain <img>.
    remotePatterns: [
      { protocol: "https", hostname: "**.yamaha-motor-india.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};
export default nextConfig;
