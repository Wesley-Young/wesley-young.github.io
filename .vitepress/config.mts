import { defineConfig } from 'vitepress'
import { listBlogs } from './list-blogs'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Young's Toy Box",
  description: "日拱一卒",
  transformPageData(pageData) {
    return {
      ...pageData,
      blogs: listBlogs(),
    }
  }
})
