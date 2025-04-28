import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        'visby': ['visby-round', 'sans-serif'],
      },
      fontWeight: {
        thin: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: '#ffffff',
        foreground: '#000000',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#000000',
        },
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#000000',
        },
        secondary: {
          DEFAULT: '#f4f4f4',
          foreground: '#000000',
        },
        muted: {
          DEFAULT: '#f9f9f9',
          foreground: '#666666',
        },
        accent: {
          DEFAULT: '#f5f5f5',
          foreground: '#000000',
        },
        primary: {
          DEFAULT: '#18465a',
          foreground: '#fff',
        },
        destructive: {
          DEFAULT: '#910000',
          foreground: '#fff',
        },
        hover: '#455118',
        link: '#910000'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
