---
status: approved
---

# Design brief: Aftershock

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
Pengguna sedang beraktivitas biasa di kamarnya (belajar, kerja di meja, atau rebahan) saat gempa datang tiba-tiba tanpa aba-aba. Ruangan dan benda di sekitarnya bergoyang, dan pengguna harus bergerak sendiri ke tempat aman (di bawah meja) dan merunduk, lalu bertahan sampai guncangan berhenti.

## Why it belongs on glasses
- Uses: draws in the world (menandai benda berbahaya dan tempat aman di ruangan asli), leaves your body free (pengguna harus benar-benar bergerak dan merunduk, bukan menekan tombol di layar)
- Why it's better than the phone or laptop version: latihan gempa ini soal melatih tubuh dan refleks di ruangan sungguhan tempat pengguna berada, bukan membaca materi di layar yang mudah membosankan. Phone/laptop tidak bisa menempatkan peringatan dan penanda langsung di ruangan asli sambil tangan dan tubuh pengguna tetap bebas bergerak.

## Product or overlay
- Type: overlay — merespons dan berlatih untuk ruangan asli tempat pengguna berada, tapi dengan objek virtual sebagai stand-in
- What the real version would sense: benda berbahaya di kamar asli (meja, lemari, rak, kaca) dan tempat aman sungguhan
- Stand-in for the preview: Lens menampilkan benda virtual (meja, lemari, rak, kaca) berukuran asli yang sudah ditandai dari awal — benda berbahaya diberi label, tempat aman (di bawah meja) diberi penanda. Pengguna menandai sendiri lewat pinch/tunjuk ke benda di kamarnya adalah fitur tambahan (stretch), hanya dikerjakan kalau waktu masih ada.

## Where things live
- Bahasa: semua teks di dalam Lens (pengingat, instruksi, peringatan, hasil) dwibahasa Indonesia/Inggris, misalnya "GEMPA! / EARTHQUAKE!"
- Where the user is looking during the main task: berputar mengelilingi ruangan virtual untuk mengenali label benda berbahaya dan lokasi safe zone, lalu ke bawah meja saat gempa berlangsung
- Pengingat keselamatan: di depan pandangan pengguna, tampil paling awal sebelum apa pun lain muncul
- Ruangan virtual (meja, lemari, rak, kaca): mengelilingi pengguna dalam jarak dekat dan berukuran asli, seperti berdiri di tengah kamar sungguhan
- Label benda berbahaya: menempel pada tiap benda virtual (lemari, rak, kaca) sejak Lens dimulai
- Penanda safe zone: di bawah meja, terlihat sejak awal, berkedip/menyala saat gempa mulai
- Panah kecil penunjuk arah: muncul di depan pandangan pengguna, menunjuk ke safe zone, hanya saat meja/safe zone tidak terlihat dari posisi pengguna
- Instruksi teks: di depan pandangan pengguna, berganti otomatis sesuai progres ("Kenali benda berbahaya dan ingat letak safe zone / Know the hazards and remember the safe zone" → "Pergi ke bawah meja / Go under the table" → "Merunduk / Duck down" → "Tahan sampai guncangan berhenti / Hold until the shaking stops")
- Health bar dan timer: muncul di depan pandangan pengguna saat gempa mulai
- Peringatan "GEMPA! / EARTHQUAKE!": besar, di depan pandangan pengguna, saat gempa mulai
- Layar hasil (setelah skor atau game over): di depan pandangan pengguna, menjelaskan apa yang terjadi dan menampilkan tombol untuk mengulang

## Hands and input
- Melanjutkan dari layar pengingat keselamatan: pinch pada tombol lanjut
- Bergerak ke safe zone: WASD (gerak jalan fisik di preview), bukan pinch atau tombol
- Merunduk: Q/E untuk menurunkan posisi kepala/kamera; Lens mendeteksi dari tinggi kepala apakah pengguna sudah merunduk
- Lens mendeteksi otomatis apakah pengguna sudah berada di safe zone dan sudah merunduk, tanpa aksi tangan tambahan
- Mengulang latihan dari layar hasil (skor atau game over): pinch pada tombol ulang
- Menandai benda sendiri dengan pinch/tunjuk: fitur tambahan (stretch), dikerjakan hanya jika waktu masih ada
- Voice: tidak digunakan

## When things show
- Pengingat keselamatan: muncul paling pertama sebelum apa pun lain, menampilkan "Ini latihan, bukan peringatan gempa sungguhan / This is a drill, not a real earthquake alert" dan "Pastikan ruanganmu aman untuk bergerak / Make sure your room is safe to move in"; hilang setelah pengguna pinch tombol lanjut
- Label benda berbahaya dan penanda safe zone: terlihat setelah pengingat keselamatan ditutup, sebelum gempa mulai
- Instruksi "Kenali benda berbahaya dan ingat letak safe zone / Know the hazards and remember the safe zone": muncul sebelum gempa, hilang saat gempa mulai
- Efek goyang ruangan/benda dan suara gemuruh: mulai tiba-tiba tanpa aba-aba, berlangsung 45–60 detik
- Peringatan besar "GEMPA! / EARTHQUAKE!": muncul saat gempa mulai
- Penanda safe zone: berubah jadi berkedip/menyala saat gempa mulai
- Health bar dan timer: muncul saat gempa mulai, timer berjalan selama guncangan (45–60 detik)
- Panah kecil penunjuk safe zone: muncul kapan saja selama gempa jika meja/safe zone tidak terlihat dari pandangan pengguna, hilang begitu safe zone kembali terlihat
- Instruksi bertahap selama gempa: "Pergi ke bawah meja / Go under the table" → (setelah sampai) "Merunduk / Duck down" → (setelah merunduk) "Tahan sampai guncangan berhenti / Hold until the shaking stops", masing-masing muncul mengikuti progres pengguna
- Health bar: turun sedikit demi sedikit jika pengguna berdiri sebelum guncangan selesai; berhenti turun saat pengguna merunduk lagi di safe zone
- Skor: muncul setelah gempa berhenti dan pengguna keluar dari safe zone. Dihitung dari gabungan kecepatan pengguna sampai di safe zone dan merunduk, ditambah sisa health di akhir
- Layar hasil (skor): menjelaskan pencapaian pengguna, dengan tombol (pinch) untuk mengulang latihan
- Game over: muncul jika health habis sebelum guncangan selesai, dengan layar hasil yang menjelaskan apa yang salah, lalu tombol (pinch) untuk mengulang latihan
- Benda jatuh dari rak/lemari saat gempa: fitur tambahan (stretch), dikerjakan hanya jika waktu masih ada
- If something needs attention out of view: panah kecil menunjuk ke safe zone, hanya muncul saat meja/safe zone tidak terlihat dari posisi pengguna

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Saat Lens dibuka, pengingat keselamatan dwibahasa muncul lebih dulu; setelah pengguna pinch tombol lanjut, pengguna dikelilingi meja, lemari, rak, dan kaca virtual berukuran asli, benda berbahaya sudah berlabel, penanda safe zone terlihat, dan instruksi awal muncul.
2. Setelah menunggu, gempa datang tanpa aba-aba: ruangan dan benda bergoyang, gemuruh terdengar, peringatan "GEMPA! / EARTHQUAKE!" muncul, penanda safe zone berkedip, dan health bar serta timer muncul.
3. Kalau pengguna menoleh sampai safe zone tidak terlihat, panah kecil muncul dan menunjuk ke safe zone; pengguna berjalan ke bawah meja dengan WASD lalu merunduk dengan Q/E, instruksi dwibahasa berganti sendiri sampai "Tahan sampai guncangan berhenti / Hold until the shaking stops", dan Lens mengenali bahwa pengguna sudah aman.
4. Kalau pengguna berdiri sebelum guncangan selesai, health turun sedikit demi sedikit dan skor berkurang; kalau health habis, muncul layar hasil game over yang menjelaskan apa yang salah, dan pinch tombol ulang memulai latihan dari awal.
5. Guncangan berhenti setelah 45–60 detik, dan setelah pengguna keluar dari safe zone, layar skor muncul dengan skor dari kecepatan dan sisa health, beserta tombol ulang.

## Out of scope
- Mengenali benda berbahaya sungguhan di kamar asli pengguna lewat kamera (glasses tidak bisa mengenali benda nyata).
- Menandai benda secara manual oleh pengguna lewat pinch/tunjuk — stretch goal, bukan bagian inti.
- Benda jatuh dari rak/lemari saat gempa — stretch goal, bukan bagian inti.
- Latihan untuk lebih dari satu ruangan atau skenario gempa yang berbeda-beda.
- Dua pengguna berbagi satu Lens secara bersamaan.
- Menyimpan progres atau skor antar sesi.

## Risks and open questions
- Deteksi "benda berbahaya" dan "tempat aman" menggunakan benda virtual yang sudah ditandai dari awal, bukan pengenalan benda asli di kamar pengguna — ini dipertahankan oleh learner sebagai pendekatan utama karena preview tidak bisa mengenali benda nyata.
- "Feel unproven": rasa nyaman merunduk dan bergerak sungguhan dengan head-tracking asli di glasses hanya bisa diuji di perangkat SPECS asli, tidak di preview.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

## Revisions
- 27 Oct 2026, learner: in-Lens text gets a language picker (Bahasa Indonesia, English, Deutsch, 日本語, 简体中文) on the first screen; the chosen language shows on top with English below so judges can read it. Replaces the fixed Indonesian / English pair once built (Slice 5L). Strings: docs/STRINGS_I18N.md.
