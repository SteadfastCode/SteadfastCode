<template>
  <div class="chat-window">
    <p style="color: #f97316">
      You’re chatting with Leo <span class="lsb">(Colossians 3:23, LSB)</span>
    </p>
    <!-- Chat UI goes here -->
  </div>
</template>
<script setup>
// Implement chat logic here (fetch from /api/chat)
</script>
<style scoped>
.chat-window {
  background: #2d3748;
  border-radius: 8px;
  padding: 12px;
  min-height: 200px;
  color: #fff;
  font-family: 'Roboto', sans-serif;
}
.lsb {
  color: #4a90e2;
}
</style>
