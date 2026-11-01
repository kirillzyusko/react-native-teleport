import type { ReactNode } from "react";
import Lottie from "lottie-react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import { useBaseUrlUtils } from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";

const lottie = {
  width: 600,
  height: 600,
};

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx(styles.landing, styles.heroBanner)}>
      <div className="container">
        <div className="preview">
          <Lottie
            animationData={require("@site/static/img/lottie/ufo.lottie.json")}
            loop={true}
            autoPlay={true}
            style={lottie}
          />
        </div>
        <Heading as="h1" className={styles.title}>
          {siteConfig.title}
        </Heading>
        <p className={styles.subtitle}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

const trustedBy = [
  {
    img: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/8b/60/fc/8b60fc5e-3e0c-f15c-3fd0-7495256ca043/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/512x512bb.jpg",
    alt: "Krak money app by Kraken",
    link: "https://x.com/dorian__mazur/status/2110052540012212545",
    name: "Krak",
  },
  {
    img: "https://avatars.githubusercontent.com/u/8597527?s=200&v=4",
    alt: "GetStream react-native chat SDK",
    link: "https://github.com/GetStream/stream-chat-react-native",
    name: "GetStream",
  },
  {
    img: "https://avatars.githubusercontent.com/u/94025540?s=200&v=4",
    alt: "Tamagui UI kit",
    link: "https://github.com/tamagui/tamagui",
    name: "Tamagui",
  },
  {
    img: "/img/trusted-by/kyoo.png",
    alt: "Kyoo media library",
    link: "https://github.com/zoriya/Kyoo",
    name: "Kyoo",
  },
  {
    img: "https://avatars.githubusercontent.com/u/180446025?s=200&v=4",
    alt: "Yosemite Crew animal health app",
    link: "https://github.com/YosemiteCrew/Yosemite-Crew",
    name: "Yosemite Crew",
  },
  {
    img: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/5f/0b/ba/5f0bba12-9375-900f-df83-966cf98d4973/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg",
    alt: "Trezor Suite app",
    link: "https://github.com/trezor/trezor-suite",
    name: "Trezor Suite",
  },
  {
    img: "https://avatars.githubusercontent.com/u/130477477?s=200&v=4",
    alt: "Xyne Spaces mobile app",
    link: "https://github.com/juspay/xyne-spaces",
    name: "Xyne",
  },
  {
    img: "https://avatars.githubusercontent.com/u/102188003?s=200&v=4",
    alt: "Tlon Messenger app",
    link: "https://github.com/tloncorp/tlon-apps",
    name: "Tlon",
  },
  {
    img: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/d1/a0/cc/d1a0cc29-d406-dbc8-5900-b47b575c9fce/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg",
    alt: "Bible Strong app",
    link: "https://github.com/smontlouis/bible-strong",
    name: "Bible Strong",
  },
  {
    img: "/img/trusted-by/screen-transitions.svg",
    alt: "react-native-screen-transitions library",
    link: "https://github.com/eds2002/react-native-screen-transitions",
    name: "Screen Transitions",
  },
  {
    img: "/img/trusted-by/screen-choreography.svg",
    alt: "react-native-screen-choreography library",
    link: "https://github.com/DorianMazur/react-native-screen-choreography",
    name: "Screen Choreography",
  },
];

function TrustedBy() {
  const { withBaseUrl } = useBaseUrlUtils();

  return (
    <section className={clsx(styles.landing, styles.trustedBySection)}>
      <Heading as="h2" className={styles.trustedByTitle}>
        Trusted by
      </Heading>
      <div className={styles.trustedByContainer}>
        {trustedBy.map((item) => (
          <a
            key={item.name}
            className={styles.trustedByItem}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              alt={item.alt}
              className={styles.trustedByImg}
              src={withBaseUrl(item.img)}
            />
            <h4>{item.name}</h4>
          </a>
        ))}
      </div>
      <p className={styles.addYourApp}>
        Would like to show your project here?{" "}
        <a href="https://github.com/kirillzyusko/react-native-teleport/edit/main/docs/src/pages/index.tsx">
          Submit a PR
        </a>
      </p>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.tagline}
      description="Teleport views across your component tree for seamless transitions and powerful UI patterns"
    >
      <HomepageHeader />
      <main>
        <TrustedBy />
      </main>
    </Layout>
  );
}
