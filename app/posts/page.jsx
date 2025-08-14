import Link from "next/link";
import { PostCard } from "nextra-theme-blog";
import { getPosts, getTags } from "./get-posts";

export const metadata = {
  title: "Posts",
};

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div data-pagefind-ignore="all">
      <h1>{metadata.title}</h1>
      {posts.map((post) => (
        <PostCard key={post.route} post={post} />
      ))}
    </div>
  );
}
