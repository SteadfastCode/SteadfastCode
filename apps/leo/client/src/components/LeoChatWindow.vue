<template>
  <div class="chat-window">
    <div class="messages-wrapper" ref="messagesWrapper">
      <div class="messages-container">
        <div v-for="(msg, i) in messages" :key="i" :class="msg.role">
          <strong v-if="msg.role === 'bot'">Leo: </strong>{{ msg.text }}
        </div>
      </div>
    </div>
    <div class="input-container">
      <v-text-field
        v-model="input"
        label="Type your question…"
        @keyup.enter="send"
        hide-details
        dense
        color="#F97316"
      />
      <v-btn color="primary" @click="send" :disabled="!input">Send</v-btn>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import axios from 'axios';

const props = defineProps({
  website: String,
  faqs: Array,
  messages: Array,
});

const emit = defineEmits(['add-message']);

const input = ref('');
const messagesWrapper = ref(null);

// Auto-scroll to bottom when messages change
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (messagesWrapper.value) {
      messagesWrapper.value.scrollTop = messagesWrapper.value.scrollHeight;
    }
  }
);

async function send() {
  if (!input.value) return;
  emit('add-message', { role: 'user', text: input.value });
  try {
    console.log('Sending request to:', '/api/chat');
    console.log('Request body:', {
      userId: 'anon',
      businessId: props.website,
      query: input.value,
    });

    const res = await axios.post('/api/chat', {
      userId: 'anon',
      businessId: props.website,
      query: input.value,
    });

    console.log('Response:', res.data);
    emit('add-message', { role: 'bot', text: res.data.response });
  } catch (error) {
    console.error('Chat error:', error);
    emit('add-message', {
      role: 'bot',
      text: "Sorry, I'm having trouble answering right now.",
    });
  }
  input.value = '';
}
</script>

<style scoped>
.chat-window {
  background: #2d3748;
  border-radius: 8px;
  color: #fff;
  font-family: 'Roboto', sans-serif;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 12px;
}

.messages-wrapper {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 12px;
  min-height: 0;
}

.messages-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 100%;
}

.input-container {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.user {
  color: #4a90e2;
  margin-bottom: 4px;
  text-align: right;
}

.bot {
  color: #f97316;
  margin-bottom: 4px;
}
</style>
