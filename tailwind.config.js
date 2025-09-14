/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'prussian-blue': '#003049', // Biru gelap untuk teks utama atau latar belakang
                'fire-red': '#D62828', // Merah untuk aksen, tombol, atau notifikasi penting
                'tangerine': '#F77F00', // Oranye untuk highlight atau peringatan
                'papaya-whip': '#FDF0D5', // Krem untuk latar belakang utama aplikasi
                'lemon-chiffon': '#EAE2B7', // Kuning pucat untuk latar belakang sekunder atau kartu
            },
        },
    },
    plugins: [],
}