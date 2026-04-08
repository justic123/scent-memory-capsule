/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- 这里告诉 Tailwind 去 src 目录下扫描代码
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}