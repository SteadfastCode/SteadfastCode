import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import LeoAI from "./views/LeoAI.vue";
import Privacy from "./views/Privacy.vue";
import Contact from "./views/Contact.vue";
import About from "./views/About.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/leoai", component: LeoAI },
  { path: "/privacy", component: Privacy },
  { path: "/contact", component: Contact },
  { path: "/about", component: About },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
