<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8">
        <h1 class="text-center mb-4">Welcome to SteadfastCode</h1>
        <p class="text-center">
          Empower your business with LeoAI's cutting-edge solutions.
        </p>
        <v-btn color="primary" block class="mt-4" to="/leoai"
          >Discover LeoAI</v-btn
        >
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: "Home",
};
</script>

<style scoped>
h1 {
  color: #f97316;
}
</style>
