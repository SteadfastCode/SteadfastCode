import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "dark",
    themes: {
      dark: {
        colors: {
          background: "#1A202C",
          surface: "#2D3748",
          primary: "#4A90E2",
          secondary: "#F97316",
        },
      },
    },
  },
});

const app = createApp(App);
app.use(router);
app.use(vuetify);
app.mount("#app");
