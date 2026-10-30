# Aftershock — education cards (F4, DRAFT for learner review)

Shown after the drill, chosen by what happened (at most 2 cards per result). Text is short enough for a 40 cm panel (two lines at 2 cm). DE/JA/ZH are translated after the learner approves the Indonesian and English.

Sources:
- [BMKG] BMKG, "Antisipasi Gempa Bumi", https://bmkg.go.id/gempabumi/mitigasi/antisipasi-gempabumi (accessed 29 Oct 2026)
- [BMKG-JICA] BMKG & JICA, "Siaga Gempabumi dan Tsunami" booklet, https://content.bmkg.go.id/wp-content/uploads/IDN_Siaga-Gempabumi-dan-Tsunami_Booklet.pdf (accessed 29 Oct 2026)

| Key | Shown when | Bahasa Indonesia | English | Source |
|---|---|---|---|---|
| `card.stayUnder` | the user stood up or left cover before the shaking stopped | Tetap lindungi kepala dan badan di bawah meja sampai guncangan benar-benar berhenti. | Keep your head and body under the table until the shaking has fully stopped. | [BMKG] Saat gempa, di dalam bangunan: "Lindungi kepala dan badan Anda … dengan bersembunyi di bawah meja" |
| `card.falling` | the user was in a danger zone or hit by a falling item | Penyebab celaka terbanyak saat gempa adalah kejatuhan benda. Jauhi lemari, rak, lampu, dan kaca. | Most earthquake injuries come from falling objects. Stay away from cabinets, shelves, lamps and glass. | [BMKG] Sebelum gempa, no. 4: "Penyebab celaka yang paling banyak … akibat kejatuhan material" |
| `card.bed` | the user ducked on the bed | Kasur tidak melindungi kepala dari benda yang jatuh. Cari meja yang kokoh. | A bed does not shield your head from falling objects. Find a sturdy table. | Derived from [BMKG] (cover under a table); not a direct quote |
| `card.fasten` | a cabinet, shelf or TV was in the room and the user was hit, or as a general tip | Ikat atau paku lemari dan rak ke dinding, dan simpan benda berat di bagian bawah. | Fasten cabinets and shelves to the wall, and keep heavy things low. | [BMKG] Sebelum gempa, no. 3 and no. 4 |
| `card.evac` | evacuation reached or failed | Setelah guncangan berhenti, keluar dengan tertib. Jangan pakai lift, gunakan tangga biasa. | After the shaking stops, leave calmly. Do not use the lift; take the stairs. | [BMKG] Setelah gempa, no. 1 |
| `card.check` | an aftershock happened | Setelah keluar, periksa yang terluka, kebocoran gas, dan kebakaran. Waspadai gempa susulan. | Once outside, check for injuries, gas leaks and fire. Expect aftershocks. | [BMKG] Setelah gempa, no. 1 and no. 2 |
| `card.coast` | general tip, shown on a perfect drill (nothing else to say) | Di dekat pantai: jika gempa sangat kuat atau terasa sekitar 1 menit atau lebih, segera menjauh ke tempat tinggi. | Near the coast: if the shaking is very strong or lasts about a minute or more, move to high ground at once. | [BMKG-JICA] tanda peringatan tsunami (i) |

Rules (default): the first matching card in table order is shown; a second card only if it is `card.fasten` or `card.check`; `card.coast` only when no other card applies.
