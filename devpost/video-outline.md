# Rencana video demo: Aftershock

Panduan ini dalam Bahasa Indonesia. Semua yang **masuk ke video** (narasi, subtitle, teks di layar) harus dalam bahasa Inggris dan ditandai **🎬 EN**. Narasi adalah kata-katamu sendiri: di setiap slot ada `[your words]` dan satu pertanyaan pemandu. Aku tidak menulis kalimat narasinya.

## Aturan yang berlaku (dari halaman hackathon, diambil 2 Nov 2026)

- Video demo, **publik di YouTube**, di bawah 3 menit, yang menunjukkan Lens bekerja. Rekaman layar preview Lens Studio sudah cukup. Kalau bisa, ceritakan juga proses desainmu.
- "Reviewers won't clone or run your project, so the video has to show it working." Jadi juri menilai **hanya dari video, repo, dan teks**.
- Batas submit: **10 Nov 2026 05:00 WIB** (9 Nov 22:00 UTC). Target internal: video final **8 Nov**.

| Kriteria (bobot sama, skala 1–5) | Yang harus terlihat di video |
|---|---|
| Design: produk utuh, bukan sekadar bukti teknis | Alur lengkap dari pilih bahasa sampai hasil, UI kaca yang konsisten, edukasi BMKG |
| Technical: dibangun dengan baik, memakai CLAD, Lens Studio, MCP | Ruangan acak, gempa yang bisa diulang persis, 29 tes LEAF lulus, cara kerja agent |
| Innovation: seberapa baru idenya | Latihan dengan tubuh di AR, lalu "perbaiki kamar" dan ulangi gempa yang sama |
| Presentation: end-to-end, masalah, untuk siapa, kenapa penting | Masalah di awal, alur tanpa putus, durasi pas |

## Adegan (total ±2:35 dari batas 3:00)

| # | Waktu | Kriteria | Yang terlihat di layar | Slot narasi |
|---|---|---|---|---|
| 1 | 0:00–0:15 | Presentation | Kartu judul hitam: **🎬 EN "Aftershock — an earthquake drill you walk through"**, lalu potongan 2 detik saat banner GEMPA! muncul | `[your words]` — Apa masalahnya? (Indonesia, ribuan gempa setahun, latihan jarang dan membosankan) |
| 2 | 0:15–0:30 | Design | Pilih bahasa → layar keselamatan → pilih tingkat (Normal) → kalibrasi merunduk | `[your words]` — Untuk siapa Lens ini? |
| 3 | 0:30–0:45 | Design / Technical | Briefing: sapuan pindai, label bahaya muncul satu per satu, safe zone di bawah meja | `[your words]` — Apa yang harus diingat pengguna sebelum gempa? |
| 4 | 0:45–1:15 | Design | **Gempa**: banner, ruangan bergoyang, berjalan ke bawah meja (WASD), merunduk (Q), pegang kaki meja; langkah HUD tercentang satu per satu; satu benda jatuh di dekatmu | `[your words]` — Kenapa ini harus dilatih dengan tubuh, bukan dibaca? |
| 5 | 1:15–1:30 | Design | Guncangan berhenti → keluar → jalan ke pintu → panel hasil (skor 4 bagian + kartu BMKG) | `[your words]` — Apa arti skornya? |
| 6 | 1:30–1:40 | Innovation | "Lihat ulang": jejakmu di lantai, merah di zona bahaya | `[your words]` (opsional, boleh tanpa narasi) |
| 7 | 1:40–2:05 | Innovation | **Momen "oh, keren"**: "Perbaiki kamar" → pinch rak → hijau "Sudah diikat" → "Ulangi gempa" → gempa yang sama, rak tidak menjatuhkan apa-apa → **"5 dari 6 benda jatuh tercegah"** + ceklis "Untuk kamarmu malam ini" | `[your words]` — Apa yang kamu ingin orang lakukan di kamarnya setelah ini? |
| 8 | 2:05–2:25 | Technical | Proses: potongan cepat `docs/` (design brief, rencana), satu sesi CLAD berjalan di terminal, log LEAF **"All 29 scenarios passed"**, perbandingan sebelum/sesudah UI | `[your words]` — Bagaimana kamu membangunnya dengan agent? Apa yang kamu pelajari? |
| 9 | 2:25–2:35 | Presentation | Kartu penutup: **🎬 EN "Aftershock · built with CLAD in Lens Studio"**, link repo, "What's next: your real room (World Query, Spatial Anchors)" | `[your words]` — Apa langkah berikutnya? |

Kalau total melewati 2:45, potong adegan 6 dulu, lalu persingkat adegan 3.

## Teks di layar yang boleh kutulis (bukan narasi)

Ini label faktual, bukan kalimat pitch. Kamu boleh ganti semuanya.

- **🎬 EN** Kartu judul: "Aftershock"
- **🎬 EN** Label adegan kecil di pojok: "1 · Pick a language", "2 · Briefing", "3 · The quake", "4 · Result", "5 · Watch again", "6 · Fix the room", "7 · How it was built"
- **🎬 EN** Kartu penutup: "github.com/FairoLegends/Aftershock"

## Cara merekam

1. **Bahasa di dalam Lens.** Juri membaca bahasa Inggris. Pilihan: rekam alur utama dalam **English** (semua panel dan suara Inggris), atau dalam **Bahasa Indonesia** dengan subtitle Inggris. Lihat pertanyaan 1 di bawah.
2. **Kamar yang sama di setiap take.** Sebelum merekam, set `layoutSeed` dan `planSeed` di komponen DrillConfig ke angka yang sama (bukan 0), supaya rak, TV, dan jatuhnya barang sama setiap kali. Kembalikan ke 0 setelah merekam (tes membutuhkannya). Aku bisa memilihkan seed yang kamarnya paling bagus (rak + TV + lemari terlihat dari titik awal, rak menjatuhkan barang).
3. **Backdrop**: Plane (lantai grid kosong), seperti semua screenshot. Furnished backdrop membuat furnitur virtual menembus sofa.
4. **Perekam**: OBS (sudah terpasang di laptopmu), Display Capture, 1920×1080, audio desktop **nyala**, mikrofon **mati**. Suara Lens (gemuruh, suara pemandu, kaca pecah) ikut terekam.
5. **Narasi direkam terpisah**, satu file per adegan, jeda 2 detik di antaranya.
6. Saat merekam, jangan sentuh Lens Studio selain kontrol preview. Tutup notifikasi Windows (Focus Assist).
7. **Pembagian kerja yang kusarankan**: kamu merekam adegan 2–7 dengan WASD/Q/E (gerakan tubuh harus terlihat alami, ini inti idenya). Aku bisa merekam adegan yang sulit diperagakan (benda jatuh tepat di dekatmu, TV roboh) lewat MCP dengan ffmpeg, dan adegan 8 (log LEAF, terminal). Lalu aku menyusun semuanya.
8. **Penyuntingan**: kamu memakai CapCut. Aku bisa menyiapkan potongan per adegan dan file `.srt` subtitle dari kata-katamu. **Musik dari CapCut jangan dipakai** (lisensinya hanya untuk TikTok/CapCut); Lens sudah punya suaranya sendiri.
9. YouTube: **Public**, bukan Unlisted atau terjadwal.

## Pertanyaan terbuka (jawab sebelum merekam)

1. Bahasa di dalam Lens saat merekam: **English** (disarankan, juri langsung paham) atau Bahasa Indonesia dengan subtitle Inggris?
2. Narasi: suaramu sendiri dalam bahasa Inggris, atau hanya subtitle tanpa suara?
3. Wajahmu ikut tampil (misalnya di adegan 8), atau hanya layar?
4. Pembagian kerja di poin 7 di atas: setuju, atau kamu rekam semua sendiri?
5. Tanggal rekam: 7 Nov, sesuai rencana?

## Keputusan

_(diisi setelah kamu menjawab)_
