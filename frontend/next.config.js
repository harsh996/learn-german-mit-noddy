/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["three", "@met4citizen/talkinghead", "@met4citizen/headaudio"],
};

module.exports = nextConfig;
