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
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Helvetica', 'Arial', 'system-ui', 'sans-serif'],
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
        "border-hover": "hsl(var(--border-hover))",
        input: "hsl(var(--input))",
        "input-border": "hsl(var(--input-border))",
        ring: "hsl(var(--ring))",
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        "secondary-background": "hsl(var(--secondary-background))",
        "tertiary-background": "hsl(var(--tertiary-background))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
          dark: "hsl(var(--primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          hover: "hsl(var(--secondary-hover))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          dark: "hsl(var(--muted-dark))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          light: "hsl(var(--accent-light))",
          dark: "hsl(var(--accent-dark))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
          border: "hsl(var(--popover-border))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          border: "hsl(var(--card-border))",
        },
        // Apple HIG Label colors
        label: {
          DEFAULT: "hsl(var(--label))",
          secondary: "hsl(var(--secondary-label))",
          tertiary: "hsl(var(--tertiary-label))",
          quaternary: "hsl(var(--quaternary-label))",
        },
        // Apple HIG Separator colors
        separator: {
          DEFAULT: "hsl(var(--separator))",
          opaque: "hsl(var(--separator-opaque))",
        },
      },
      borderRadius: {
        'xl': "var(--radius-xl)",
        'lg': "var(--radius-lg)",
        DEFAULT: "var(--radius)",
        'md': "var(--radius)",
        'sm': "var(--radius-sm)",
        'xs': "6px",
      },
      boxShadow: {
        'elegant': 'var(--shadow-md)',
        'glow': 'var(--shadow-glow)',
        'soft': 'var(--shadow-sm)',
        'subtle': '0 1px 2px 0 hsl(220 13% 69% / 0.05)',
        'premium': 'var(--shadow-md)',
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-secondary': 'var(--gradient-secondary)',
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-glass': 'var(--gradient-glass)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0', opacity: '0' },
          to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
          to: { height: '0', opacity: '0' }
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'scale-out': {
          from: { transform: 'scale(1)', opacity: '1' },
          to: { transform: 'scale(0.96)', opacity: '0' }
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px hsl(var(--primary) / 0.1)' },
          '50%': { boxShadow: '0 0 30px hsl(var(--primary) / 0.2)' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        // Apple-style spring bounce
        'bounce-in': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'bounce-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(0.9)', opacity: '0' },
        },
        // Apple-style press effect
        'press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        // Apple-style wiggle for attention
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
      },
      animation: {
        // Apple spring easing: cubic-bezier(0.2, 0.8, 0.2, 1)
        'accordion-down': 'accordion-down 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'accordion-up': 'accordion-up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'fade-out': 'fade-out 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'scale-out': 'scale-out 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'slide-down': 'slide-down 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'slide-in-left': 'slide-in-left 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'slide-in-from-bottom': 'slide-in-from-bottom 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'float': 'float 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'bounce-in': 'bounce-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'bounce-out': 'bounce-out 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'press': 'press 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'wiggle': 'wiggle 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
