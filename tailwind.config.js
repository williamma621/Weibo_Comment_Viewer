// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5', // Indigo 600
        secondary: '#7C3AED', // Violet 600
        slate: {
          50: '#F8FAFC',
          500: '#64748B',
          900: '#0F172A',
        },
        success: '#10B981',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(79, 70, 229, 0.1)',
        'hover-card': '0 10px 25px -5px rgba(79, 70, 229, 0.15), 0 8px 10px -6px rgba(79, 70, 229, 0.1)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}