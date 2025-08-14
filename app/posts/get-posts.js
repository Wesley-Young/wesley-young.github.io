import { normalizePages } from "nextra/normalize-pages";
import { getPageMap } from "nextra/page-map";

export async function getPosts() {
  const { directories } = normalizePages({
    list: await getPageMap(),
    route: "/posts",
  });
  return directories
    .filter((post) => post.name !== "index" && post.name !== "posts")
    .sort(
      (a, b) => new Date(b.frontMatter.date) - new Date(a.frontMatter.date)
    );
}

