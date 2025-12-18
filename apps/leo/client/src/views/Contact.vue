<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="8">
        <h1 class="text-center mb-6">Get in Touch</h1>
        <v-card color="#2D3748" class="pa-4 mb-6 afterglow-card">
          <v-card-text>
            <p class="text-center mb-4">
              Want to save time and grow your business with AI you can trust? Let’s chat—I’d
              love to show you how LeoAI works! Email us at
              <a href="mailto:contact@steadfastcode.tech">contact@steadfastcode.tech</a>. Or fill out the form below and I’ll get back to you as soon as possible.
            </p>
            <v-form @submit.prevent="submitForm" ref="form">
              <v-text-field
                v-model="name"
                label="Name"
                color="primary"
                required
                :rules="[v => !!v || 'Name is required']"
              ></v-text-field>
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                color="primary"
                required
                :rules="[v => !!v || 'Email is required', v => /.+@.+\..+/.test(v) || 'Email must be valid']"
              ></v-text-field>
              <v-textarea
                v-model="message"
                label="Message"
                color="primary"
                required
                :rules="[v => !!v || 'Message is required']"
              ></v-textarea>
              <v-btn color="primary" type="submit" block x-large class="elevation-3">
                Send Message
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Contact',
  data() {
    return {
      name: '',
      email: '',
      message: '',
    };
  },
  methods: {
    async submitForm() {
      if (this.$refs.form.validate()) {
        try {
          await axios.post('/api/inquiry', {
            name: this.name,
            email: this.email,
            message: this.message,
          });
          alert('Message sent successfully!');
          this.$refs.form.reset();
        } catch (error) {
          alert('Error sending message.');
        }
      }
    },
  },
};
</script>

<style scoped>
h1 {
  font-family: 'Roboto', sans-serif;
  color: #F97316;
  font-weight: 700;
}
p, a {
  color: #ffffff;
}
a {
  text-decoration: none;
  color: #4A90E2;
}
</style>