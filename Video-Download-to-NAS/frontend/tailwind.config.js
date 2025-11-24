/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'yt-red': '#ff0000',
        'yt-dark': '#0f0f0f',
        'yt-darker': '#0a0a0a',
        'yt-light': '#212121',
      },
      keyframes: {
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        slideDown: 'slideDown 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
