/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './media/**/*.html',
    './assets/**/*.js',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        navy: "#052a64",
        green: "#4ba755",
        lightgrey: "#d9d9d9",
        darkgrey: "#737373",
        amber: "#f59e0b",
        red: "#ef4444",
      },
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
