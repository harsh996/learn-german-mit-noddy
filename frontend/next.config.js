/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["three", "@met4citizen/talkinghead"],
};

module.exports = nextConfig;
