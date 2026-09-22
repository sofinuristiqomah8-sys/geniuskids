/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // The create wizard submits the child's photo through a Server Action.
      // Next's default body limit is 1 MB, but downscaleImage() falls back to
      // the ORIGINAL file (up to MAX_PHOTO_BYTES = 10 MB) whenever the browser
      // can't decode it — e.g. iPhone HEIC. Without this, those uploads 500
      // before createStory's try/catch can run. Keep this above 10 MB.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    // Supabase Storage public URLs are served from the project subdomain.
    // A white-label buyer's own Supabase URL is read from env at build time.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
