import { createVuetify } from 'vuetify'
import 'vuetify/styles'

export default createVuetify({
  theme: {
    defaultTheme: 'steadfast',
    themes: {
      steadfast: {
        dark: true,
        colors: {
          primary: '#4a90e2',
          secondary: '#f97316',
          background: '#000000',
          surface: '#1a202c',
        },
      },
    },
  },
})
