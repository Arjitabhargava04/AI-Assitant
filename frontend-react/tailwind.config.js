export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent:  '#C4934A',
        accent2: '#8B6A35',
        ag:      'rgba(196,147,74,0.15)',
        bg:      '#0D0D0D',
        bg2:     '#141414',
        bg3:     '#1C1C1C',
        bg4:     '#222222',
        b1:      '#2A2A2A',
        b2:      '#333333',
        t1:      '#E8E2D9',
        t2:      '#9A9080',
        t3:      '#6B6055',
        ubg:     '#1A1712',
        abg:     '#111111',
        danger:  '#e74c3c',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'serif'],
        sans:  ['Inter', 'sans-serif'],
        mono:  ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
