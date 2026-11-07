/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231c",
        cream: "#f6f7f2",
        lime: "#dff36d",
        forest: "#234c38"
      },
      boxShadow: {
        soft: "0 14px 45px rgba(23,35,28,.08)"
      }
    }
  },
  plugins: []
};
