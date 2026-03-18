<template>
  <div class="afterglow-card waitlist-card">
    <button class="back-btn" @click="$emit('close')">&#8592; Back</button>
    <iframe
      data-tally-src="https://tally.so/embed/b5OKjo?alignLeft=1&hideTitle=1&transparentBackground=1"
      loading="lazy"
      width="100%"
      height="100%"
      frameborder="0"
      marginheight="0"
      marginwidth="0"
      title="Leo AI Waitlist"
    ></iframe>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

defineEmits(['close'])

onMounted(() => {
  const src = 'https://tally.so/widgets/embed.js'
  const load = () => {
    if (typeof Tally !== 'undefined') {
      Tally.loadEmbeds()
    } else {
      document.querySelectorAll('iframe[data-tally-src]:not([src])').forEach(e => {
        e.src = e.dataset.tallySrc
      })
    }
  }
  if (typeof Tally !== 'undefined') {
    load()
  } else if (!document.querySelector(`script[src="${src}"]`)) {
    const s = document.createElement('script')
    s.src = src
    s.onload = load
    s.onerror = load
    document.body.appendChild(s)
  } else {
    load()
  }
})
</script>

<style scoped>
.afterglow-card {
  background: #2d3748;
  border-radius: 10px;
  padding: 20px;
  margin: 20px auto;
  border: 1px solid #4a90e2;
  box-shadow: 0 0 15px #4a90e2;
  max-width: 90%;
  text-align: left;
  color: #ffffff;
  box-sizing: border-box;
}

.back-btn {
  display: none;
  background: none;
  border: none;
  color: #f97316;
  font-size: 0.95em;
  cursor: pointer;
  padding: 0 0 12px 0;
  font-family: Arial, sans-serif;
}

.back-btn:hover {
  text-decoration: underline;
}

@media (max-width: 767px) {
  .afterglow-card {
    max-width: 90%;
  }

  .back-btn {
    display: block;
  }
}

@media (min-width: 768px) {
  .afterglow-card {
    max-width: 420px;
    margin: 20px 0 20px 0;
    height: 640px;
    display: flex;
    flex-direction: column;
  }

  iframe {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>
