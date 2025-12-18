// src/plugins/vuetify.js
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import { aliases, mdi } from 'vuetify/iconsets/mdi';

export default createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        colors: {
          background: '#2D3748',
          primary: '#F97316',
          accent: '#F97316',
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
});
