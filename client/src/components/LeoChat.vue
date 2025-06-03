<template>
  <!-- Chat Bubble (Mobile) -->
  <v-btn
    v-if="!drawer && isMobile"
    class="leo-bubble"
    color="#F97316"
    fab
    @click="drawer = true"
    aria-label="Open LeoAI Chat"
  >
    <v-icon>mdi-robot</v-icon>
  </v-btn>

  <!-- Chat Drawer -->
  <v-navigation-drawer
    v-model="drawer"
    :right="!isMobile"
    :bottom="isMobile"
    :width="isMobile ? '100%' : '30vw'"
    app
    temporary
    class="leo-drawer"
    color="#2D3748"
  >
    <v-toolbar flat color="#2D3748">
      <v-toolbar-title class="leo-title">
        <v-icon left color="#F97316">mdi-robot</v-icon>
        LeoAI
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="drawer = false"><v-icon>mdi-close</v-icon></v-btn>
    </v-toolbar>
    <v-divider />
    <div class="leo-content">
      <div v-if="step === 0">
        <h2>Welcome to LeoAI!</h2>
        <p>
          Let’s get your chatbot set up.
          <span class="lsb">Colossians 3:23 (LSB)</span>
        </p>
        <v-btn color="primary" @click="step++">Start Setup</v-btn>
      </div>
      <div v-else-if="step === 1">
        <h3>1. Your Website URL</h3>
        <v-text-field
          v-model="website"
          label="Website URL"
          prepend-inner-icon="mdi-web"
        />
        <v-btn color="primary" @click="step++" :disabled="!website">Next</v-btn>
      </div>
      <div v-else-if="step === 2">
        <h3>2. Site Learning Options</h3>
        <v-checkbox v-model="options.hours" label="Business Hours" />
        <v-checkbox v-model="options.services" label="Services" />
        <v-checkbox v-model="options.contact" label="Contact Info" />
        <v-checkbox v-model="options.faqs" label="FAQs" />
        <v-btn color="primary" @click="step++">Next</v-btn>
      </div>
      <div v-else-if="step === 3">
        <h3>3. Select Pricing Tier</h3>
        <v-select
          v-model="tier"
          :items="tiers"
          label="Pricing Tier"
          item-text="label"
          item-value="value"
        />
        <v-btn color="primary" @click="step++" :disabled="!tier">Next</v-btn>
        <div class="upsell" v-if="tier && tier !== 'infinity'">
          <p>
            Need unlimited messages?
            <v-btn text color="#F97316" @click="tier = 'infinity'"
              >Upgrade to Infinity Plan</v-btn
            >
          </p>
        </div>
      </div>
      <div v-else-if="step === 4">
        <h3>4. Add FAQs</h3>
        <v-text-field
          v-model="faqInput"
          label="Add FAQ"
          @keyup.enter="addFaq"
        />
        <v-list>
          <v-list-item v-for="(faq, i) in faqs" :key="i">
            <v-list-item-content>{{ faq }}</v-list-item-content>
            <v-btn icon @click="removeFaq(i)"
              ><v-icon>mdi-delete</v-icon></v-btn
            >
          </v-list-item>
        </v-list>
        <v-btn color="primary" @click="step++">Next</v-btn>
      </div>
      <div v-else-if="step === 5">
        <h3>5. Embed LeoAI</h3>
        <p>Copy and paste this script tag into your website:</p>
        <v-textarea readonly :value="embedScript" rows="2" />
        <v-btn color="primary" @click="step++">Finish</v-btn>
        <div class="upsell">
          <p>
            <v-icon color="#F97316">mdi-flash</v-icon>
            Try <strong>Leo Refresh</strong> for daily updates ($10/mo) or
            <strong>Messenger</strong> alerts ($5/mo)!
          </p>
        </div>
      </div>
      <div v-else>
        <h3>LeoAI is Ready!</h3>
        <p>
          You're all set. Chat with Leo below or manage settings in your
          dashboard.
        </p>
        <LeoChatWindow :website="website" :faqs="faqs" />
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDisplay } from 'vuetify';
import LeoChatWindow from './LeoChatWindow.vue';

const { mobile } = useDisplay();
const drawer = ref(false);
const step = ref(0);
const website = ref('');
const options = ref({ hours: true, services: true, contact: true, faqs: true });
const tier = ref('');
const tiers = [
  { label: 'Free (0-100)', value: 'free' },
  { label: 'Base (101-499)', value: 'base' },
  { label: 'Extra (500-699)', value: 'extra' },
  { label: 'Plus (700-999)', value: 'plus' },
  { label: 'Premium (1,000-1,499)', value: 'premium' },
  { label: 'Pro (1,500-1,999)', value: 'pro' },
  { label: 'Enterprise (2,000-2,499)', value: 'enterprise' },
  { label: 'Infinity (Unlimited)', value: 'infinity' },
];
const faqs = ref([]);
const faqInput = ref('');
const isMobile = computed(() => mobile.value);

function addFaq() {
  if (faqInput.value.trim()) {
    faqs.value.push(faqInput.value.trim());
    faqInput.value = '';
  }
}
function removeFaq(i) {
  faqs.value.splice(i, 1);
}
const embedScript = computed(() => {
  return (
    '<script src="https://steadfastcode.tech/leo.js" data-website="' +
    website.value +
    '"><\\/script>'
  );
});
</script>

<style scoped>
.leo-bubble {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
  box-shadow: 0 4px 16px #f97316;
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
  padding: 16px;
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
@media (min-width: 960px) {
  .leo-drawer {
    top: 0;
    right: 0;
    height: 100vh !important;
    width: 30vw !important;
    max-width: 420px;
    border-radius: 0;
  }
}
</style>
