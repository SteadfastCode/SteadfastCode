<template>
  <v-app>
    <v-main>
      <div class="site-container">
        <h1 class="site-title">Steadfast Code</h1>
        <ComingSoonCard />
        <div class="cards-row" :class="{ 'waitlist-active': showWaitlist }">
          <div class="leoai-wrapper">
            <LeoAICard :waitlist-open="showWaitlist" @show-waitlist="showWaitlist = true" />
          </div>
          <Transition name="waitlist">
            <WaitlistCard v-if="showWaitlist" @close="showWaitlist = false" />
          </Transition>
        </div>
        <AppFooter />
      </div>
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

/* Cards layout */
.cards-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* Mobile: swap LeoAI card out when waitlist opens */
@media (max-width: 767px) {
  .waitlist-active .leoai-wrapper {
    display: none;
  }
}

/* Desktop: side by side */
@media (min-width: 768px) {
  .site-title {
    font-size: 4em;
  }

  .cards-row {
    flex-direction: row;
    justify-content: center;
    align-items: flex-start;
    gap: 24px;
  }
}

/* Waitlist slide transition */
.waitlist-enter-active {
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
}

.waitlist-leave-active {
  transition: transform 0.35s ease-in, opacity 0.3s ease;
}

/* Mobile: slide up from below */
.waitlist-enter-from,
.waitlist-leave-to {
  opacity: 0;
  transform: translateY(32px);
}

/* Desktop: slide out from behind the main card */
@media (min-width: 768px) {
  .waitlist-enter-from,
  .waitlist-leave-to {
    opacity: 0;
    transform: translateX(-60px);
  }
}
</style>
