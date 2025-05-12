# Changelog

Semua perubahan penting pada extension "AnimePrayer Notifier" akan didokumentasikan dalam file ini.

## [1.0.1] - 2024-11-20

### Fixed

- Memperbaiki bug gambar yang tidak muncul pada notifikasi salat
- Menambahkan fungsi fallback ke gambar cloud jika gambar lokal tidak dapat dimuat
- Memperbaiki Content Security Policy (CSP) untuk mengizinkan akses gambar
- Memperbaiki proses pemilihan gambar kustom oleh pengguna

### Added

- Kemampuan memilih gambar kustom melalui perintah "Pilih Gambar untuk Notifikasi Salat"
- Fallback ke gambar default jika tidak ada gambar yang dipilih
- Pesan error yang lebih jelas saat terjadi masalah dengan gambar

### Changed

- Tampilan webview yang lebih modern dan responsive
- Peningkatan performa dan stabilitas

## [1.0.0] - 2024 (Initial Release)

### Added

- Fitur notifikasi waktu salat berdasarkan zona waktu (WIB, WITA, WIT)
- Integrasi dengan API Aladhan untuk mendapatkan jadwal salat yang akurat
- Tampilan webview dengan tema anime kawaii
- Pengaturan zona waktu sesuai lokasi pengguna
