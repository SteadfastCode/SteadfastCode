<template>
  <v-app>
    <!-- Top Navigation Bar -->
    <v-app-bar app color="#1A202C" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer" class="d-md-none"></v-app-bar-nav-icon>
      <v-toolbar-title>SteadfastCode</v-toolbar-title>
      <v-spacer></v-spacer>
      <!-- Desktop Menu -->
      <v-btn
        v-for="item in menuItems"
        :key="item.title"
        :to="item.path"
        text
        class="d-none d-md-flex"
        :class="{ 'active-link': $route.path === item.path }"
      >
        {{ item.title }}
      </v-btn>
    </v-app-bar>

    <!-- Mobile Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" app temporary color="#2D3748" dark>
      <v-list>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.path"
          @click="drawer = false"
        >
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main>
      <router-view></router-view>
    </v-main>

    <!-- Footer -->
    <v-footer app color="#1A202C" dark class="text-center">
      <v-col cols="12">
        <p class="mb-0">© 2025 Steadfast Code. All rights reserved.</p>
      </v-col>
    </v-footer>
    <LeoChat />
  </v-app>
</template>

<script>
import LeoChat from './components/LeoChat.vue';
export default {
  name: 'App',
  components: {
    LeoChat
  },
  data() {
    return {
      drawer: false,
      menuItems: [
        { title: 'Home', path: '/' },
        { title: 'LeoAI', path: '/leoai' },
        { title: 'Privacy', path: '/privacy' },
        { title: 'Contact', path: '/contact' },
        { title: 'About', path: '/about' },
      ],
    };
  },
};
</script>

<style>
#app {
  font-family: 'Roboto', sans-serif;
  background-color: #1A202C;
  color: #ffffff;
}
.active-link {
  color: #F97316 !important;
}
.v-btn {
  text-transform: none;
}
</style>