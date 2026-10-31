import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      screens: {
        // Téléphone ou tablette (écran tactile) en paysage : priorité au live,
        // vidéo plein écran et chat en dessous (défilement). min-width évite
        // qu'un téléphone en portrait clavier ouvert (viewport plus large que
        // haut) bascule dans cette mise en page.
        touchland: { raw: "(orientation: landscape) and (hover: none) and (pointer: coarse) and (min-width: 600px)" },
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Charte Scutify
        brand: {
          navy: "#003366",
          "navy-dark": "#00254a",
          "navy-light": "#0b4f8f",
          sky: "#66ccff",
          "sky-light": "#e6f6ff",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "live-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
