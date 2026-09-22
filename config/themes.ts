/**
 * ============================================================================
 *  STORY THEME CATALOG (white-label editable)
 * ============================================================================
 *  Tema Utama (main theme) → Sub Tema (specific situation to improve).
 *  Captured from the reference app + extended. A buyer can freely add/remove
 *  themes and sub-themes here; the creation wizard reads this file directly.
 *
 *  `id` is a stable slug stored in the database. `label` is the display text.
 * ============================================================================
 */

export type SubTheme = {
  id: string;
  label: string;
};

export type Theme = {
  id: string;
  label: string;
  /** Short helper shown under the main theme (optional). */
  hint?: string;
  subThemes: SubTheme[];
};

export const themes: Theme[] = [
  {
    id: "karakter-positif",
    label: "Karakter Positif",
    subThemes: [
      { id: "jujur", label: "Jujur" },
      { id: "sabar", label: "Sabar" },
      { id: "rendah-hati", label: "Rendah Hati" },
      { id: "tanggung-jawab", label: "Tanggung Jawab" },
      { id: "pemaaf", label: "Pemaaf" },
      { id: "disiplin", label: "Disiplin" },
    ],
  },
  {
    id: "kebiasaan-baik",
    label: "Kebiasaan Baik",
    subThemes: [
      { id: "bangun-pagi", label: "Bangun Pagi" },
      { id: "merapikan-mainan", label: "Merapikan Mainan" },
      { id: "gosok-gigi", label: "Rajin Gosok Gigi" },
      { id: "makan-sendiri", label: "Makan Sendiri" },
      { id: "tidur-tepat-waktu", label: "Tidur Tepat Waktu" },
    ],
  },
  {
    id: "adab-islami",
    label: "Adab Islami",
    subThemes: [
      { id: "adab-makan", label: "Adab Makan & Minum" },
      { id: "adab-tidur", label: "Adab Tidur" },
      { id: "adab-salam", label: "Mengucap Salam" },
      { id: "adab-orang-tua", label: "Adab kepada Orang Tua" },
      { id: "menutup-aurat", label: "Menutup Aurat" },
    ],
  },
  {
    id: "doa-harian",
    label: "Doa Harian",
    subThemes: [
      { id: "doa-makan", label: "Doa Sebelum Makan" },
      { id: "doa-tidur", label: "Doa Sebelum Tidur" },
      { id: "doa-keluar-rumah", label: "Doa Keluar Rumah" },
      { id: "doa-kedua-orang-tua", label: "Doa untuk Orang Tua" },
      { id: "doa-masuk-kamar-mandi", label: "Doa Masuk Kamar Mandi" },
    ],
  },
  {
    id: "kecerdasan-emosi",
    label: "Kecerdasan Emosi",
    subThemes: [
      { id: "mengenal-perasaan", label: "Mengenal Perasaan" },
      { id: "mengelola-marah", label: "Mengelola Rasa Marah" },
      { id: "berani-cerita", label: "Berani Bercerita" },
      { id: "empati", label: "Berempati pada Teman" },
      { id: "percaya-diri", label: "Percaya Diri" },
    ],
  },
  {
    id: "cerdas-bergaul",
    label: "Cerdas Bergaul",
    // Sub-themes below are taken directly from the reference app.
    subThemes: [
      { id: "berteman-baik", label: "Berteman Baik" },
      { id: "tidak-pilih-pilih-teman", label: "Tidak Pilih-pilih Teman" },
      { id: "antri-dengan-sabar", label: "Antri dengan Sabar" },
      { id: "tidak-mengejek-teman", label: "Tidak Mengejek Teman" },
      { id: "membela-yang-lemah", label: "Membela yang Lemah" },
      { id: "bekerja-sama", label: "Bekerja Sama" },
      { id: "mengalah-pada-adik", label: "Mengalah pada Adik" },
      { id: "sayang-adik", label: "Sayang Adik" },
      { id: "hormat-pada-kakak", label: "Hormat pada Kakak" },
      { id: "membantu-ibu", label: "Membantu Ibu" },
      { id: "membantu-ayah", label: "Membantu Ayah" },
      { id: "menyenangkan-kakek-nenek", label: "Menyenangkan Kakek-Nenek" },
      { id: "sopan-ke-tetangga", label: "Sopan ke Tetangga" },
      { id: "tidak-membantah-orang-tua", label: "Tidak Membantah Orang Tua" },
    ],
  },
  {
    id: "calon-anak-sholeh",
    label: "Calon Anak Sholeh",
    subThemes: [
      { id: "belajar-sholat", label: "Belajar Sholat" },
      { id: "cinta-al-quran", label: "Cinta Al-Qur'an" },
      { id: "sedekah", label: "Gemar Bersedekah" },
      { id: "puasa", label: "Belajar Puasa" },
      { id: "berbakti-orang-tua", label: "Berbakti pada Orang Tua" },
    ],
  },
  {
    id: "cerdas-di-sekolah",
    label: "Cerdas di Sekolah",
    subThemes: [
      { id: "semangat-belajar", label: "Semangat Belajar" },
      { id: "berani-bertanya", label: "Berani Bertanya" },
      { id: "menghargai-guru", label: "Menghargai Guru" },
      { id: "tidak-menyontek", label: "Tidak Menyontek" },
      { id: "mengerjakan-tugas", label: "Rajin Mengerjakan Tugas" },
    ],
  },
  {
    id: "hidup-sehat",
    label: "Hidup Sehat",
    subThemes: [
      { id: "cuci-tangan", label: "Rajin Cuci Tangan" },
      { id: "makan-sayur", label: "Suka Makan Sayur & Buah" },
      { id: "olahraga", label: "Rajin Berolahraga" },
      { id: "kurangi-gadget", label: "Mengurangi Gadget" },
      { id: "istirahat-cukup", label: "Istirahat yang Cukup" },
    ],
  },
  {
    id: "cinta-lingkungan",
    label: "Cinta Lingkungan",
    subThemes: [
      { id: "buang-sampah", label: "Buang Sampah pada Tempatnya" },
      { id: "hemat-air", label: "Hemat Air" },
      { id: "menanam-pohon", label: "Menanam Pohon" },
      { id: "sayang-hewan", label: "Menyayangi Hewan" },
      { id: "hemat-listrik", label: "Hemat Listrik" },
    ],
  },
  {
    id: "bijak-bermedia",
    label: "Bijak Bermedia",
    subThemes: [
      { id: "batas-waktu-layar", label: "Batas Waktu Menonton" },
      { id: "tontonan-baik", label: "Memilih Tontonan Baik" },
      { id: "tidak-percaya-hoax", label: "Tidak Mudah Percaya" },
      { id: "sopan-online", label: "Sopan saat Daring" },
    ],
  },
  {
    id: "cerdas-finansial",
    label: "Cerdas Finansial",
    subThemes: [
      { id: "menabung", label: "Gemar Menabung" },
      { id: "membedakan-butuh-ingin", label: "Membedakan Butuh & Ingin" },
      { id: "berbagi", label: "Suka Berbagi" },
      { id: "menghargai-uang", label: "Menghargai Uang" },
    ],
  },
  {
    id: "berani-tangguh",
    label: "Berani & Tangguh",
    subThemes: [
      { id: "berani-coba-hal-baru", label: "Berani Mencoba Hal Baru" },
      { id: "tidak-mudah-menyerah", label: "Tidak Mudah Menyerah" },
      { id: "mengakui-kesalahan", label: "Berani Mengakui Kesalahan" },
      { id: "mandiri", label: "Mandiri" },
    ],
  },
  {
    id: "semangat-ramadhan",
    label: "Semangat Ramadhan",
    subThemes: [
      { id: "belajar-puasa", label: "Belajar Berpuasa" },
      { id: "sholat-tarawih", label: "Semangat Tarawih" },
      { id: "sahur", label: "Bangun Sahur" },
      { id: "berbagi-takjil", label: "Berbagi Takjil" },
    ],
  },
  {
    id: "aman-waspada",
    label: "Aman & Waspada",
    subThemes: [
      { id: "sentuhan-boleh-tidak", label: "Sentuhan Boleh & Tidak Boleh" },
      { id: "tidak-ikut-orang-asing", label: "Tidak Ikut Orang Asing" },
      { id: "hafal-alamat", label: "Hafal Nama & Alamat" },
      { id: "berani-bilang-tidak", label: "Berani Bilang Tidak" },
    ],
  },
  {
    id: "indahnya-perbedaan",
    label: "Indahnya Perbedaan",
    subThemes: [
      { id: "menghargai-teman-berbeda", label: "Menghargai Teman yang Berbeda" },
      { id: "toleransi", label: "Bersikap Toleran" },
      { id: "tidak-membeda-bedakan", label: "Tidak Membeda-bedakan" },
    ],
  },
];

/** Story length options shown in the wizard. */
export type StoryLength = {
  id: string;
  label: string;
  /** Target number of scenes/pages the generator should aim for. */
  scenes: number;
};

export const storyLengths: StoryLength[] = [
  { id: "auto", label: "Otomatis (sesuai usia)", scenes: 0 },
  { id: "short", label: "Pendek (± 4 adegan)", scenes: 4 },
  { id: "medium", label: "Sedang (± 6 adegan)", scenes: 6 },
  { id: "long", label: "Panjang (± 8 adegan)", scenes: 8 },
];

export function findTheme(id: string): Theme | undefined {
  return themes.find((t) => t.id === id);
}

export function findSubTheme(themeId: string, subId: string): SubTheme | undefined {
  return findTheme(themeId)?.subThemes.find((s) => s.id === subId);
}

/** Pick a scene count for a given length + child age (used when length = auto). */
export function resolveSceneCount(lengthId: string, age: number): number {
  const len = storyLengths.find((l) => l.id === lengthId);
  if (len && len.scenes > 0) return len.scenes;
  // Auto: younger children get shorter stories.
  if (age <= 3) return 4;
  if (age <= 5) return 6;
  return 7;
}
