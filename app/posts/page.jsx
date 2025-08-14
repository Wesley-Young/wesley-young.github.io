import { PostCard } from "nextra-theme-blog";
import { getPosts } from "./get-posts";

export const metadata = {
  title: "Young's Toy Box | 文章",
};

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div data-pagefind-ignore="all">
      <h1>文章</h1>
      {posts.map((post) => (
        <PostCard key={post.route} post={post} />
      ))}
    </div>
  );
}
