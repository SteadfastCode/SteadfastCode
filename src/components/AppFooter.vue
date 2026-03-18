<template>
  <div class="copyright">
    &copy; {{ year }} Steadfast Code. All rights reserved.
  </div>
</template>

<script setup>
const year = new Date().getFullYear()
</script>

<style scoped>
.copyright {
  font-size: 0.8em;
  margin-top: auto;
  padding: 10px;
  color: #d1d5db;
}
</style>
