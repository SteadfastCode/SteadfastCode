<template>
  <!-- SAVED FOR FUTURE BOT LOGIC IMPLEMENTATION -->
  <div v-if="step === 0">
    <h2>Welcome to LeoAI!</h2>
    <p>
      Let's get your chatbot set up.
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
        <v-btn text color="#F97316" @click="tier = 'infinity'">
          Upgrade to Infinity Plan
        </v-btn>
      </p>
    </div>
  </div>
  <div v-else-if="step === 4">
    <h3>4. Add FAQs</h3>
    <v-text-field v-model="faqInput" label="Add FAQ" @keyup.enter="addFaq" />
    <v-list>
      <v-list-item v-for="(faq, i) in faqs" :key="i">
        <v-list-item-content>{{ faq }}</v-list-item-content>
        <v-btn icon @click="removeFaq(i)">
          <v-icon>mdi-delete</v-icon>
        </v-btn>
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
</template>

<script setup>
// This component contains the setup steps logic
// To be integrated into bot responses later
</script>
