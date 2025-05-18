import { defineConfig } from 'vitepress'
import { listBlogs } from './list-blogs'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Young's Toy Box",
  description: "啥都往里塞",
  transformPageData(pageData) {
    return {
      ...pageData,
      blogs: listBlogs(),
    }
  }
})
