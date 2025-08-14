import Link from "next/link";
import { Footer, Layout, Navbar, ThemeSwitch } from "nextra-theme-blog";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-blog/style.css";
import '@fontsource/inter/100.css';
import '@fontsource/inter/200.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource-variable/noto-sans-sc';
import './styles.css';

export const metadata = {
  title: "Blog Example",
};

export default async function RootLayout({ children }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <Head backgroundColor={{ dark: "#0f172a" }} />
      <body>
        <Layout>
          <Navbar pageMap={await getPageMap()}>
            <Link href="/">Home</Link>
            <Link href="/posts">Posts</Link>
            <Link href="https://github.com/Wesley-Young">GitHub</Link>
            <ThemeSwitch />
          </Navbar>

          {children}

          <Footer>
            <abbr
              title="This site and all its content are licensed under a Creative Commons Attribution-NonCommercial 4.0 International License."
              style={{ cursor: "help" }}
            >
              CC BY-NC 4.0
            </abbr>{" "}
            {new Date().getFullYear()} © Wesley Young.
          </Footer>
        </Layout>
      </body>
    </html>
  );
}
