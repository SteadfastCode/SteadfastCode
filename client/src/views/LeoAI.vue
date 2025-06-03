<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8">
        <h1 class="text-center mb-4">LeoAI Features & Pricing</h1>
        <v-card class="mb-4" color="#2D3748">
          <v-card-title>Features</v-card-title>
          <v-card-text>
            <ul>
              <li>24/7 AI chatbot for customer support</li>
              <li>Website integration with setup drawer</li>
              <li>Customizable responses via Hugging Face NLP</li>
            </ul>
          </v-card-text>
        </v-card>
        <v-card class="mb-4" color="#2D3748">
          <v-card-title>Pricing</v-card-title>
          <v-card-text>
            <ul>
              <li>Free: 0-100 messages/month</li>
              <li>Base: $0.01/message</li>
              <li>Infinity Plan: $20/month</li>
              <li>Lifetime Plan: $777 one-time</li>
            </ul>
          </v-card-text>
        </v-card>
        <v-btn color="primary" block to="/contact">Get Started</v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: "LeoAI",
};
</script>

<style scoped>
h1 {
  color: #f97316;
}
</style>
