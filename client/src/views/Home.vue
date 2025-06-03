<template>
  <v-container fluid class="hero">
    <v-row justify="center" align="center" class="fill-height">
      <v-col cols="12" md="8" class="text-center">
        <h1 class="display-2 mb-4">Steadfast Code: Coming Soon!</h1>
        <p class="subtitle-1 mb-6">
          We’re excited to bring you LeoAI, an AI-driven chatbot designed to save
          small business owners 5+ hours a week. Built with a faith-driven approach,
          LeoAI learns your website, answers customer questions, and grows with your
          business.
        </p>
        <v-btn color="primary" x-large to="/contact" class="elevation-3">
          Get Started
        </v-btn>
      </v-col>
    </v-row>
    <v-row justify="center" class="mt-12">
      <v-col cols="12" md="8">
        <v-card color="#2D3748" class="pa-4 afterglow-card">
          <v-card-text class="text-center">
            <p>
              Steadfast Code – Empowering small business owners everywhere with easy
              & affordable AI, one conversation at a time.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'Home',
};
</script>

<style scoped>
.hero {
  background: linear-gradient(180deg, #1A202C 0%, #2D3748 100%);
  min-height: 100vh;
}
.display-2 {
  font-family: 'Roboto', sans-serif;
  color: #F97316;
  font-weight: 700;
}
.subtitle-1, p {
  color: #ffffff;
  font-size: 1.25rem;
}

</style>