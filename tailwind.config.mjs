/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          cian:      '#19ADD3', // decorative, backgrounds, borders, icons (2.64:1 — not for text)
          cianDark:  '#0E7FA3', // text on light bg — AA-compliant (4.58:1 on white)
          cianClaro: '#81D8EB', // soft backgrounds, gradients, secondary surfaces
          gris:      '#767676', // text on light bg — AA-compliant (4.54:1 on white)
          grisSuave: '#B7B7B7', // subtitles, lines, dividers, discrete backgrounds
        },
      },
      fontFamily: {
        // Georgia serif — verse body; do NOT replace with brand sans.
        reading: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        // Inter — UI chrome, titles, nav; light weights, wide tracking.
        brand:   ['Inter', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        // Caveat — RESERVED for short emotional phrases only ("una gran familia").
        script:  ['"Caveat"', 'cursive'],
      },
      borderRadius: {
        brand: '1.25rem', // generous-air art direction
      },
    },
  },
  plugins: [],
};
