import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

let baseUrl = "/react-native-teleport/";

if (process.env.PREVIEW_PATH) {
  baseUrl += process.env.PREVIEW_PATH;
}

const config: Config = {
  title: "Teleport",
  tagline: "Missing native portal implementation for react-native",
  favicon: "img/favicon.ico",

  // Runs animations on page change
  clientModules: ["./src/modules/page-transitions.ts"],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },
  url: "https://kirillzyusko.github.io",
  baseUrl: baseUrl,

  organizationName: "kirillzyusko",
  projectName: "react-native-teleport",
  trailingSlash: false,

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/kirillzyusko/react-native-teleport/tree/main/docs",
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ["rss", "atom"],
            xslt: true,
          },
          editUrl:
            "https://github.com/kirillzyusko/react-native-teleport/tree/main/docs",
          // Useful options to enforce blogging best practices
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
        gtag: {
          trackingID: "G-W4KYGKY5MW",
          anonymizeIP: true,
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      "@signalwire/docusaurus-plugin-llms-txt",
      {
        // Plugin options
        depth: 3,
        siteTitle: "react-native-teleport",
        siteDescription:
          "Documentation for react-native-teleport. Package that allows to teleport views across your component tree for seamless transitions and powerful UI patterns.",
        content: {
          includePages: true,
          excludeRoutes: ["**/docs/1.*/**", "**/docs/next/**"],
          enableMarkdownFiles: true,
          enableLlmsFullTxt: true,
        },
      },
    ],
  ],

  themeConfig: {
    image: "img/og-image.png",
    navbar: {
      title: "Teleport",
      logo: {
        alt: "Teleport Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Guides",
        },
        {
          to: "/docs/category/api-reference",
          label: "API",
          position: "left",
        },
        { to: "/blog", label: "Blog", position: "left" },
        {
          type: "docsVersionDropdown",
          position: "left",
          dropdownActiveClassDisabled: true,
        },
        {
          href: "https://github.com/kirillzyusko/react-native-teleport/tree/main/example",
          label: "Example App",
          position: "right",
        },
        {
          href: "https://github.com/kirillzyusko/react-native-teleport",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Guides",
              to: "/docs/installation",
            },
            {
              label: "Recipes",
              to: "/docs/category/recipes",
            },
            {
              label: "API",
              to: "/docs/category/api-reference",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub discussions",
              href: "https://github.com/kirillzyusko/react-native-teleport/discussions",
            },
            {
              label: "X",
              href: "https://x.com/ziusko",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "Blog",
              to: "/blog",
            },
            {
              label: "GitHub",
              href: "https://github.com/kirillzyusko/react-native-teleport",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Kirill Zyusko. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["java", "kotlin", "swift", "json", "diff", "bash"],
    },
    metadata: [
      {
        name: "keywords",
        content:
          "react-native, portal, teleport, reparent, re-parent, re-parenting, reparentable",
      },
      { name: "og:image:width", content: "3456" },
      { name: "og:image:height", content: "1582" },
    ],
    algolia: {
      appId: "XYVIEPDGBE",
      apiKey: "f116abc1c6fdbdab99c0570075193f63",
      indexName: "react-native-teleport",
      contextualSearch: false,
      searchParameters: {},
      searchPagePath: "search",
      insights: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
