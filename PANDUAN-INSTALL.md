# Panduan Instalasi Lengkap — Vercel + Supabase

Panduan langkah demi langkah untuk menjalankan aplikasi **Genius Kids** (pembuat
buku cerita anak dengan ilustrasi, cerita, dan narasi AI) dari nol hingga online
di Vercel. Ditulis untuk pemula — cukup ikuti urutannya.

Aplikasi ini memakai **Next.js 15 + React 19**, database **Supabase**, dan AI dari
**Google AI Studio (Gemini)** untuk cerita, gambar, dan suara. Gambar juga bisa
memakai **KIE Nano Banana** yang gratis untuk pemula.

---

## Daftar Isi

1. [Yang perlu disiapkan](#1-yang-perlu-disiapkan)
2. [Ambil kode proyek](#2-ambil-kode-proyek)
3. [Siapkan Supabase (database)](#3-siapkan-supabase-database)
4. [Ambil kunci AI (Gemini & KIE)](#4-ambil-kunci-ai-gemini--kie)
5. [Konfigurasi environment variables](#5-konfigurasi-environment-variables)
6. [Coba jalankan di komputer (opsional tapi disarankan)](#6-coba-jalankan-di-komputer-opsional-tapi-disarankan)
7. [Deploy ke Vercel](#7-deploy-ke-vercel)
8. [Uji end-to-end](#8-uji-end-to-end)
9. [Kustomisasi merek (branding)](#9-kustomisasi-merek-branding)
10. [Hemat biaya & kuota](#10-hemat-biaya--kuota)
11. [Mengatasi masalah umum](#11-mengatasi-masalah-umum)
12. [Checklist sebelum go-live](#12-checklist-sebelum-go-live)

---

## 1. Yang perlu disiapkan

**Akun (semua ada versi gratis):**
- [GitHub](https://github.com) — untuk menyimpan kode
- [Supabase](https://supabase.com) — database, penyimpanan foto/gambar, login anonim
- [Google AI Studio](https://aistudio.google.com/app/apikey) — kunci Gemini (cerita, gambar, suara)
- [Vercel](https://vercel.com) — hosting aplikasi
- (Opsional) [KIE.ai](https://kie.ai/api-key) — gambar Nano Banana gratis untuk pemula

**Alat di komputer (hanya jika ingin coba lokal / langkah 6):**
- [Node.js 20 LTS](https://nodejs.org) (minimal 18.18+)
- [Git](https://git-scm.com)

> Jika tidak mau ribet, Anda bisa langsung deploy ke Vercel tanpa menjalankan di
> komputer. Tapi mencoba lokal dulu sangat membantu memastikan semuanya benar.

---

## 2. Ambil kode proyek

**Pilihan A — Fork ke GitHub Anda (disarankan untuk deploy Vercel):**
1. Buka repositori proyek di GitHub.
2. Klik **Fork** (kanan atas) agar tersalin ke akun GitHub Anda.

**Pilihan B — Clone ke komputer:**
```bash
git clone https://github.com/<akun-anda>/hellokids.git
cd hellokids
npm install
```

---

## 3. Siapkan Supabase (database)

### 3.1 Buat project
1. Masuk ke https://supabase.com → **New project**.
2. Isi nama, **Database Password** (simpan baik-baik), dan pilih **Region**
   terdekat (mis. *Southeast Asia (Singapore)*).
3. Tunggu beberapa menit sampai project selesai dibuat.

### 3.2 Aktifkan login anonim
Aplikasi ini tidak punya halaman login — setiap perangkat otomatis mendapat
identitas sendiri lewat **Anonymous sign-in**.

1. Menu kiri → **Authentication** → **Providers** (atau **Sign In / Providers**).
2. Cari **Anonymous** → **Enable** → **Save**.

### 3.3 Jalankan skema database (WAJIB)
1. Menu kiri → **SQL Editor** → **New query**.
2. Buka file **`supabase/migrations/0001_init.sql`** dari proyek, salin **seluruh
   isinya**, tempel ke editor, lalu klik **Run**.
3. File ini sekali jalan membuat: tabel `children`, `stories`, `scenes`
   (termasuk kolom multi-gambar per halaman), semua aturan keamanan **RLS**, dan
   dua **storage bucket**:
   - `child-photos` → **privat** (foto wajah anak, akses lewat signed URL)
   - `story-assets` → **publik** (ilustrasi & audio hasil generate)
4. File ini **idempotent** — aman dijalankan ulang kalau perlu.

> **Penting:** kalau langkah ini dilewati, pembuatan cerita akan error karena
> tabel/kolom belum ada.

### 3.4 Ambil kunci API Supabase
Menu kiri → **Project Settings** → **API**, lalu catat:

| Nilai di Supabase | Dipakai sebagai env |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Project API keys → **anon** **public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Project API keys → **service_role** (RAHASIA) | `SUPABASE_SERVICE_ROLE_KEY` |

> `service_role` bisa melewati semua keamanan RLS. **Jangan pernah** ditaruh di
> kode klien atau di variabel berawalan `NEXT_PUBLIC_`. Cukup di server/Vercel.

---

## 4. Ambil kunci AI (Gemini & KIE)

### 4.1 Google AI Studio (WAJIB — cerita, gambar, suara)
1. Buka https://aistudio.google.com/app/apikey.
2. **Create API key** → salin nilainya → jadi `GEMINI_API_KEY`.

Kuota gratis Gemini terbatas, terutama untuk **gambar**. Agar lebih lancar Anda
boleh menyiapkan beberapa kunci (dari project Google yang sah milik Anda) dan
mengisi `GEMINI_API_KEYS` (dipisah koma). Aplikasi akan bergilir antar-kunci dan
otomatis pindah kunci saat kena limit.

> Jika `GEMINI_API_KEYS` berisi 3+ kunci dan tidak ada pool khusus per-peran,
> kunci dibagi otomatis: kunci 1/4/7 untuk **gambar**, 2/5/8 untuk **cerita**,
> 3/6/9 untuk **audio**. Untuk kendali penuh, isi `GEMINI_IMAGE_API_KEYS`,
> `GEMINI_STORY_API_KEYS`, dan `GEMINI_AUDIO_API_KEYS`.

### 4.2 KIE Nano Banana (OPSIONAL — gambar gratis / cadangan)
Kalau kuota gambar Gemini habis, aplikasi bisa otomatis memakai **KIE Nano
Banana** sebagai cadangan gratis (akun baru dapat kredit gratis).

1. Buka https://kie.ai/api-key → salin token → jadi `KIE_API_KEY`.
2. Cukup isi `KIE_API_KEY`; cadangan otomatis aktif saat Gemini kena limit.
3. Ingin Nano Banana jadi mesin gambar **utama**? Set:
   `IMAGE_PROVIDER="kie"` dan `IMAGE_MODEL="google/nano-banana"`.

---

## 5. Konfigurasi environment variables

Semua kunci di atas dimasukkan sebagai *environment variables*. Untuk uji lokal,
buat file **`.env.local`** di root proyek (jangan di-commit). Untuk produksi,
nilai yang sama dimasukkan di **Vercel** (langkah 7).

Template minimal `.env.local` (isi dengan nilai Anda):

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="kunci-anon-public"
SUPABASE_SERVICE_ROLE_KEY="kunci-service-role-RAHASIA"

# --- AI (Gemini wajib) ---
GEMINI_API_KEY="kunci-google-ai-studio"
# Opsional: kumpulan kunci
# GEMINI_API_KEYS="kunci1,kunci2,kunci3"

# --- Gambar hemat & gratis (opsional) ---
IMAGE_RESOLUTION="1K"        # 1K (~1080px) paling murah; 2K/4K lebih mahal
# KIE_API_KEY="token-kie"    # cadangan gratis Nano Banana saat Gemini limit
```

**Referensi variabel penting:**

| Variabel | Wajib? | Fungsi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Kunci publik Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Kunci server (rahasia) untuk generate aset |
| `GEMINI_API_KEY` | ✅ | Kunci Gemini (cerita/gambar/suara) |
| `GEMINI_API_KEYS` | – | Beberapa kunci Gemini (dipisah koma) |
| `GEMINI_IMAGE_API_KEYS` / `_STORY_` / `_AUDIO_` | – | Pool kunci per-peran |
| `IMAGE_RESOLUTION` | – | `1K` (default, termurah), `2K`, atau `4K` |
| `KIE_API_KEY` | – | Cadangan gambar Nano Banana (gratis) |
| `IMAGE_PROVIDER` / `IMAGE_MODEL` | – | Ganti mesin gambar (mis. `kie` / `google/nano-banana`) |
| `STORY_MODEL` / `TTS_MODEL` / `TTS_VOICE` | – | Override model cerita/suara |

> Daftar lengkap beserta penjelasan ada di file **`.env.example`**.

---

## 6. Coba jalankan di komputer (opsional tapi disarankan)

```bash
npm install          # sekali saja
npm run dev          # buka http://localhost:3000
```

Uji cepat koneksi AI (mengetes kunci Gemini untuk cerita, gambar, dan audio):
```bash
npm run test:live
```

Cek build produksi berjalan tanpa error:
```bash
npm run build
```

Kalau `npm run dev` sudah bisa membuat 1 cerita utuh, berarti konfigurasi Anda
benar dan siap di-deploy.

---

## 7. Deploy ke Vercel

1. Push kode ke GitHub (kalau belum): `git push`.
2. Buka https://vercel.com → **Add New… → Project** → **Import** repositori Anda.
3. Framework akan terdeteksi otomatis sebagai **Next.js** (biarkan default).
4. Buka **Environment Variables**, lalu masukkan **semua** variabel dari
   `.env.local` (langkah 5) satu per satu:
   - Ketik **Name** (mis. `GEMINI_API_KEY`) dan **Value**.
   - Terapkan ke environment **Production** (dan Preview/Development bila mau).
5. Klik **Deploy** dan tunggu sampai selesai.
6. Buka domain `*.vercel.app` yang diberikan.

> **Catatan lisensi:** paket **Hobby** Vercel gratis untuk non-komersial. Untuk
> pemakaian komersial (white-label dijual), gunakan paket **Pro**.

**Setiap update kode:** cukup `git push` ke GitHub — Vercel otomatis deploy ulang.

---

## 8. Uji end-to-end

Di aplikasi yang sudah online:
1. **Buat cerita**: isi nama anak, umur, jenis kelamin, (opsional) foto, pilih
   tema & sub-tema, lalu **Buat**.
2. Tunggu tahap: **teks → gambar (2–3 per halaman) → audio**. Ada progress bar.
3. Buka **flipbook**: gambar tampil, narasi tersorot per kata, audio berjalan.
4. Sampai halaman **penutup** (moral + doa + panduan orang tua).

Kalau ilustrasi masih berupa gambar placeholder polos, artinya kuota gambar
sedang habis — lihat bagian [Hemat biaya & kuota](#10-hemat-biaya--kuota) dan
[Mengatasi masalah](#11-mengatasi-masalah-umum).

---

## 9. Kustomisasi merek (branding)

Tanpa mengubah kode inti:
- **`config/brand.ts`** — `name`, `tagline`, `subtagline`, `logoEmoji` (atau
  `logoSrc` ke gambar di `/public`), dan `colors` (palet warna).
- **`config/themes.ts`** — katalog tema & sub-tema cerita.
- **`config/providers.ts`** — model/suara default (atau lewat env di Vercel).

Detail lengkap ada di **`WHITELABEL.md`**.

---

## 10. Hemat biaya & kuota

- **Tetap di `IMAGE_RESOLUTION="1K"`** (~1080px) — paling murah dan ramah kuota
  gratis. 2K/4K ditagih lebih mahal per gambar.
- **Isi `KIE_API_KEY`** agar ada cadangan gambar Nano Banana gratis saat Gemini
  kena limit — cerita tetap dapat ilustrasi asli, bukan placeholder.
- **Beri kunci khusus gambar** lewat `GEMINI_IMAGE_API_KEYS="k1,k2,k3"` supaya
  generate gambar tidak berebut kuota dengan cerita/audio.
- Perkiraan panggilan per buku: cerita 1–2×, ilustrasi beberapa (2–3 per
  halaman), narasi ~5–9×. Kuota gratis Google bisa berubah menurut model & region
  — pantau di AI Studio / Google Cloud.

> **Perhatian:** fitur 2–3 gambar per halaman membuat jumlah generate gambar
> naik ~3×. Hemat dengan tetap di 1K + memakai cadangan KIE.

---

## 11. Mengatasi masalah umum

**Gambar tampil sebagai figur polos (placeholder), bukan ilustrasi asli**
→ Kuota gambar Gemini habis. Isi `KIE_API_KEY` (cadangan gratis), tambah kunci
gambar (`GEMINI_IMAGE_API_KEYS`), atau aktifkan billing di Google. Placeholder
akan otomatis diganti gambar asli saat Anda buka ulang ceritanya dari beranda.

**Error saat membuat cerita / "kolom tidak ditemukan"**
→ Skema belum dijalankan atau belum lengkap. Ulangi [langkah 3.3](#33-jalankan-skema-database-wajib)
(jalankan `0001_init.sql`). File-nya aman dijalankan ulang.

**Audio "masih antre" / lama**
→ Normal saat kuota TTS sibuk; aplikasi menunggu lalu mencoba lagi otomatis.
Menyiapkan beberapa kunci audio (`GEMINI_AUDIO_API_KEYS`) mempercepat.

**"API key Gemini belum di-set"**
→ `GEMINI_API_KEY` (atau `GEMINI_API_KEYS`) belum terisi di `.env.local`/Vercel.
Setelah menambah env di Vercel, lakukan **Redeploy**.

**Foto anak tidak muncul / gagal upload**
→ Pastikan bucket `child-photos` & `story-assets` ada (dibuat oleh `0001_init.sql`)
dan login **Anonymous** sudah **Enable** di Supabase.

**Sudah ubah env di Vercel tapi tidak berpengaruh**
→ Env baru butuh **Redeploy**. Buka Deployments → **Redeploy**.

---

## 12. Checklist sebelum go-live

- [ ] `config/brand.ts` sudah di-rebrand (lihat `WHITELABEL.md`)
- [ ] Project Supabase dibuat; **Anonymous auth aktif**
- [ ] Skema dijalankan (`0001_init.sql`) — tabel + RLS + bucket ada
- [ ] Semua env di Vercel terisi (Supabase + `GEMINI_API_KEY`/`GEMINI_API_KEYS`)
- [ ] `IMAGE_RESOLUTION=1K` (dan `KIE_API_KEY` bila ingin cadangan gratis)
- [ ] `npm run build` lolos tanpa error
- [ ] Uji end-to-end 1× (buat cerita → teks/gambar/audio → flipbook → penutup)
- [ ] Paket Vercel sesuai (Pro untuk komersial)
- [ ] Konten doa/cerita ditinjau kualitasnya untuk audiens Anda

---

## Catatan privasi (penting)

Foto anak diunggah ke bucket Supabase **privat** dan hanya dipakai untuk menjaga
konsistensi wajah pada ilustrasi. Menghapus cerita **tidak** otomatis menghapus
foto anak — tambahkan langkah pembersihan atau fitur "hapus data saya" bila
wilayah hukum Anda mewajibkannya (mis. COPPA/GDPR). **Minta persetujuan orang
tua** sebelum mengumpulkan foto anak.
```
