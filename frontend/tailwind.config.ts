import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        app: {
          primary: '#1e40af',
          secondary: '#0f172a',
          accent: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
