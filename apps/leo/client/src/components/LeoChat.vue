<template>
  <!-- Chat Bubble (Always visible) -->
  <v-btn
    class="leo-bubble"
    :class="{ 'leo-bubble--shifted': drawer && chatMode === 'drawer' }"
    color="#F97316"
    fab
    @click="drawer = !drawer"
    aria-label="Toggle LeoAI Chat"
  >
    <v-icon>mdi-robot</v-icon>
  </v-btn>

  <!-- Window Mode (Custom positioned) -->
  <div
    v-if="chatMode === 'window' && (drawer || isClosing)"
    class="leo-window"
    :class="{
      'leo-window--mobile': isMobile,
      'leo-window-enter': drawer,
      'leo-window-leave': isClosing,
    }"
  >
    <v-card color="#1A202C" class="leo-window-card">
      <v-toolbar flat color="#1A202C" class="leo-window-toolbar">
        <v-toolbar-title class="leo-title">
          <v-icon left color="#F97316">mdi-robot</v-icon>
          LeoAI
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="drawer = false"><v-icon>mdi-close</v-icon></v-btn>
      </v-toolbar>
      <v-divider />
      <v-card-text class="leo-content">
        <!-- Chat Mode Toggle (for demo) -->
        <div class="mode-toggle mb-4">
          <v-btn-toggle v-model="chatMode" mandatory>
            <v-btn value="window" size="small">Window</v-btn>
            <v-btn value="drawer" size="small">Drawer</v-btn>
          </v-btn-toggle>
        </div>

        <!-- Chat Interface -->
        <div class="chat-container">
          <LeoChatWindow
            :website="website"
            :faqs="faqs"
            :messages="messages"
            @add-message="messages.push($event)"
          />
        </div>
      </v-card-text>
    </v-card>
  </div>

  <!-- Drawer Mode (Custom positioned) -->
  <div
    v-if="chatMode === 'drawer' && (drawer || isClosing)"
    class="leo-drawer-custom"
    :class="{
      'leo-drawer-custom--mobile': isMobile,
      'leo-drawer-enter': drawer,
      'leo-drawer-leave': isClosing,
    }"
  >
    <v-card color="#1A202C" class="leo-drawer-card">
      <v-toolbar flat color="#1A202C">
        <v-toolbar-title class="leo-title">
          <v-icon left color="#F97316">mdi-robot</v-icon>
          LeoAI
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="drawer = false"><v-icon>mdi-close</v-icon></v-btn>
      </v-toolbar>
      <v-divider />
      <div class="leo-content pa-4">
        <!-- Chat Mode Toggle (for demo) -->
        <div class="mode-toggle mb-4">
          <v-btn-toggle v-model="chatMode" mandatory>
            <v-btn value="window" size="small">Window</v-btn>
            <v-btn value="drawer" size="small">Drawer</v-btn>
          </v-btn-toggle>
        </div>

        <!-- Chat Interface -->
        <div class="chat-container">
          <LeoChatWindow
            :website="website"
            :faqs="faqs"
            :messages="messages"
            @add-message="messages.push($event)"
          />
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useDisplay } from 'vuetify';
import LeoChatWindow from './LeoChatWindow.vue';

const { mobile } = useDisplay();
const drawer = ref(false);
const isClosing = ref(false);
const chatMode = ref('window'); // 'window' or 'drawer'
const website = ref('');
const faqs = ref([]);

// Move messages state here to persist across open/close
const messages = ref([
  { role: 'bot', text: "Hi! I'm Leo. How can I help you today?" },
]);

const isMobile = computed(() => mobile.value);

// Handle closing animation
watch(drawer, async (newVal) => {
  if (!newVal && !isClosing.value) {
    isClosing.value = true;
    // Wait for animation to complete
    await new Promise((resolve) => setTimeout(resolve, 250));
    isClosing.value = false;
  }
});
</script>

<style scoped>
.leo-bubble {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
  box-shadow: 0 4px 16px #f97316;
  transition: right 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.leo-bubble--shifted {
  right: 0;
}

.leo-bubble--shifted.leo-bubble {
  right: 424px;
}

.leo-window {
  position: fixed;
  bottom: 90px;
  right: 10px;
  width: 500px;
  height: 80vh;
  z-index: 1500;
}

.leo-window.leo-window-enter {
  animation: scaleFromBubble 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.leo-window.leo-window-leave {
  animation: scaleToBubble 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.leo-window--mobile {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-height: 100%;
}

.leo-window-card {
  border-radius: 15px !important;
  overflow: hidden;
  height: 100%;
  background: #1a202c !important;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 0 20px rgba(249, 115, 22, 0.2) !important;
}

.leo-window-toolbar {
  border-radius: 15px 15px 0 0 !important;
}

@keyframes scaleFromBubble {
  0% {
    transform: scale(0) translate(0, 500px);
    transform-origin: bottom right;
    opacity: 0;
  }
  100% {
    transform: scale(1);
    transform-origin: bottom right;
    opacity: 1;
  }
}

@keyframes scaleToBubble {
  from {
    transform: scale(1);
    transform-origin: bottom right;
    opacity: 1;
  }
  to {
    transform: scale(0) translate(0, 500px);
    transform-origin: bottom right;
    opacity: 0;
  }
}

.leo-drawer-custom {
  position: fixed;
  top: 64px;
  bottom: 0;
  right: 0;
  width: 400px;
  height: auto;
  z-index: 1500;
}

.leo-drawer-custom.leo-drawer-enter {
  animation: slideFromRight 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.leo-drawer-custom.leo-drawer-leave {
  animation: slideToRight 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.leo-drawer-custom--mobile.leo-drawer-enter {
  animation: slideFromBottom 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.leo-drawer-custom--mobile.leo-drawer-leave {
  animation: slideToBottom 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.leo-drawer-card {
  height: 100%;
  border-radius: 0;
  background: #1a202c !important;
  box-shadow:
    -10px 0 30px rgba(0, 0, 0, 0.3),
    0 0 20px rgba(249, 115, 22, 0.1) !important;
}

@keyframes slideFromRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideToRight {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}

@keyframes slideFromBottom {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes slideToBottom {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

.leo-drawer {
  font-family: 'Roboto', sans-serif;
  background: #2d3748 !important;
  color: #fff;
}

.leo-title {
  color: #f97316;
  font-family: 'Roboto', sans-serif;
}
.leo-content {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.mode-toggle {
  flex-shrink: 0;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column-reverse;
  min-height: 0;
  overflow: hidden;
}
.upsell {
  margin-top: 16px;
  background: #1a202c;
  border-radius: 8px;
  padding: 12px;
  color: #f97316;
}
.lsb {
  font-size: 0.9em;
  color: #4a90e2;
}
</style>
