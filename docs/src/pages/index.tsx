import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import clsx from "clsx";
import Lottie from "lottie-react";

import styles from "./index.module.css";

import type { ReactNode } from "react";

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
            autoPlay={true}
            loop={true}
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

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout
      description="Teleport views across your component tree for seamless transitions and powerful UI patterns"
      title={siteConfig.tagline}
    >
      <HomepageHeader />
    </Layout>
  );
}
