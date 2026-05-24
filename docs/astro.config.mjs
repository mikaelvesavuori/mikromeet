// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mikrosuite.com",
  base: "/meet/docs",
  integrations: [
    starlight({
      title: "MikroMeet Docs",
      description: "Self-hosted WebRTC meetings with lightweight signaling, rooms, chat, moderation, and static frontend deployment.",
      favicon: "/favicon.svg",
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/mikaelvesavuori/mikromeet",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "What is MikroMeet?", link: "/getting-started/introduction" },
            { label: "Installation", link: "/getting-started/installation" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Configuration", link: "/guides/configuration" },
            { label: "Authentication", link: "/guides/authentication" },
            { label: "Meeting Features", link: "/guides/meeting-features" },
            { label: "Deployment", link: "/guides/deployment" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "Comparison", link: "/reference/comparison" },
            { label: "Server Options", link: "/reference/cli-server" },
            { label: "API Reference", link: "/reference/api" },
          ],
        },
      ],
    }),
  ],
});
