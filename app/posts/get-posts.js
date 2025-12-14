import { normalizePages } from 'nextra/normalize-pages';
import { getPageMap } from 'nextra/page-map';

const specialPosts = [
  'index',
  'posts',
  'friends'
];

export async function getPosts() {
  const { directories } = normalizePages({
    list: await getPageMap(),
    route: '/posts',
  });
  return directories
    .filter((post) => !specialPosts.includes(post.name))
    .sort((a, b) => new Date(b.frontMatter.date) - new Date(a.frontMatter.date));
}
