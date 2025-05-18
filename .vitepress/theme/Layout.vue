<script setup lang="ts">
import { useData } from 'vitepress'

// https://vitepress.dev/reference/runtime-api#usedata
const { site, frontmatter, page } = useData()

</script>

<template>
  <div class="display-box">
    <div class="responsive-width">
      <p><a href="/">Home</a> | <a href="/about">About</a> | {{ site.title }}</p>
      <div v-if="frontmatter.home">
        <h1>{{ site.title }}</h1>
        <p>{{ site.description }}</p>
        
        <ul> 
          <li v-for="blog in page.blogs">
            <a :href="blog.link">{{ blog.text }}</a>
          </li>
        </ul>
      </div>
      <div v-else>
        <h1>{{ frontmatter.title }}</h1>
        <Content />
      </div>
    </div>
  </div>
</template>

<style>
.display-box {
  display: flex;
  justify-content: center;
  height: 100vh;
}

.responsive-width {
  width: 90%;
}

@media (min-width: 1024px) {
  .responsive-width {
    width: 50%;
  }
}
</style>