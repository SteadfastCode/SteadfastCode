<template>
  <v-app>
    <v-main>
      <div class="site-container">
        <h1 class="site-title">Steadfast Code</h1>
        <ComingSoonCard />
        <LeoAICard @show-waitlist="openWaitlist" />
        <AppFooter />
      </div>
      <Transition name="overlay">
        <WaitlistCard v-if="showWaitlist" @close="showWaitlist = false" />
      </Transition>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import ComingSoonCard from './components/ComingSoonCard.vue'
import LeoAICard from './components/LeoAICard.vue'
import WaitlistCard from './components/WaitlistCard.vue'
import AppFooter from './components/AppFooter.vue'

const showWaitlist = ref(false)

function openWaitlist() {
  showWaitlist.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: linear-gradient(to top, #000000, #1a202c);
}

.v-application {
  background: transparent !important;
}

.v-main {
  background: transparent !important;
  position: relative !important;
}

.site-container {
  font-family: Arial, sans-serif;
  color: #ffffff;
  text-align: center;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
}

.site-title {
  color: #00375f;
  font-family: 'Roboto Slab', serif;
  font-size: 2.5em;
  font-weight: 700;
  text-shadow: 0 0 10px #00d5f1, 0 0 27px #ff9500;
}

@media (min-width: 768px) {
  .site-title {
    font-size: 4em;
  }
}

/* Overlay fade transition */
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
