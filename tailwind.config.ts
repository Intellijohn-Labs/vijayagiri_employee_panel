import type { Config } from "tailwindcss";

const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        canvas: channel("canvas"),
        surface: channel("surface"),
        overlay: channel("overlay"),
        hover: channel("hover"),
        fg: channel("fg"),
        muted: channel("muted"),
        faint: channel("faint"),
        "accent-text": channel("accent-text"),
        accent: {
          DEFAULT: channel("accent"),
          hover: channel("accent-hover"),
          fg: channel("accent-fg"),
        },
        ok: channel("ok"),
        warn: channel("warn"),
        danger: channel("danger"),
        info: channel("info"),
      },
      borderColor: { DEFAULT: "var(--line)", line: "var(--line)", strong: "var(--line-strong)" },
      backgroundColor: {
        tint: "var(--accent-tint)",
        "ok-tint": "rgb(var(--ok) / 0.12)",
        "warn-tint": "rgb(var(--warn) / 0.12)",
        "danger-tint": "rgb(var(--danger) / 0.12)",
        "info-tint": "rgb(var(--info) / 0.12)",
      },
      boxShadow: {
        ring: "0 0 0 3px var(--accent-glow)",
        pop: "var(--shadow-pop)",
        card: "var(--shadow-card)",
      },
      borderRadius: { xl: "0.875rem" },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] },
    },
  },
  plugins: [],
};
export default config;
