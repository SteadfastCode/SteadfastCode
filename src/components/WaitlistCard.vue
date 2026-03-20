<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="afterglow-card">
      <button class="close-btn" @click="$emit('close')">&times;</button>
      <div class="iframe-wrapper">
        <iframe
          data-tally-src="https://tally.so/r/b5OKjo"
          width="100%"
          height="100%"
          frameborder="0"
          marginheight="0"
          marginwidth="0"
          title="Leo AI Waitlist"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

defineEmits(['close'])

onMounted(() => Tally.loadEmbeds())
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.afterglow-card {
  position: relative;
  background: #2d3748;
  border-radius: 10px;
  border: 1px solid #4a90e2;
  box-shadow: 0 0 15px #4a90e2;
  width: 100%;
  max-width: 700px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  padding: 40px 20px 20px;
  box-sizing: border-box;
}

.iframe-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
}

iframe {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border: 0;
  width: 100%;
  height: 100%;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  color: #f97316;
  font-size: 1.6em;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: #ffffff;
}

@media (max-width: 767px) {
  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    min-height: 100%;
    align-items: flex-start;
  }

  .afterglow-card {
    height: 1360px;
    max-width: 100%;
  }
}
</style>
