import * as vscode from "vscode";
import fetch from "node-fetch";

// Tipe data untuk respons API
interface PrayerApiResponse {
  data: {
    timings: Record<string, string>; // Key adalah nama salat, value adalah waktu dalam format HH:mm
  };
}

export function activate(context: vscode.ExtensionContext) {
  // show webview command
  let showWebviewCommand = vscode.commands.registerCommand(
    "animeprayer-notifier.showWebview",
    () => {
      showAnimeImage(context, "Test"); // Panggil showAnimeImage dengan parameter "Test"
    }
  );

  context.subscriptions.push(showWebviewCommand);

  let chooseImageCommand = vscode.commands.registerCommand(
    "animeprayer-notifier.chooseImage",
    () => {
      chooseImage(context);
    }
  );
  context.subscriptions.push(chooseImageCommand);

  // Periksa apakah zona waktu sudah disimpan
  const savedTimezone = context.globalState.get<string>("selectedTimezone");

  if (savedTimezone) {
    vscode.window.showInformationMessage(
      `Zona waktu Anda adalah ${savedTimezone}.`
    );
    const timezoneOffset = getTimezoneOffset(savedTimezone);
    checkPrayerTimes(context, timezoneOffset);
  } else {
    // Jika belum, minta pengguna memilih zona waktu
    vscode.window
      .showQuickPick(["WIB", "WITA", "WIT"], {
        placeHolder: "Pilih Zona Waktu Anda (WIB, WITA, WIT)",
      })
      .then((selectedZone) => {
        if (!selectedZone) {
          vscode.window.showErrorMessage(
            "Anda harus memilih zona waktu terlebih dahulu."
          );
          return;
        }

        // Simpan pilihan pengguna
        context.globalState.update("selectedTimezone", selectedZone);
        vscode.window.showInformationMessage(
          `Zona waktu ${selectedZone} telah disimpan.`
        );

        // Mulai proses cek waktu salat
        const timezoneOffset = getTimezoneOffset(selectedZone);
        checkPrayerTimes(context, timezoneOffset);
      });
  }
}

// Fungsi untuk mendapatkan offset zona waktu dalam jam
function getTimezoneOffset(zone: string): number {
  switch (zone) {
    case "WITA":
      return 8; // WITA (GMT+8)
    case "WIT":
      return 9; // WIT (GMT+9)
    case "WIB":
    default:
      return 7; // WIB (GMT+7)
  }
}
// production
async function checkPrayerTimes(
  context: vscode.ExtensionContext,
  timezoneOffset: number
) {
  const location = { latitude: -6.192538, longitude: 106.831918 };
  const apiUrl = `https://api.aladhan.com/v1/timings?latitude=${location.latitude}&longitude=${location.longitude}&method=2`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (isPrayerApiResponse(data)) {
      const timings = data.data.timings;
      const prayerTimes = convertToSelectedTimezone(timings, timezoneOffset);

      // Set interval untuk pengecekan setiap menit
      setInterval(() => {
        const now = new Date();
        for (const [prayer, time] of Object.entries(prayerTimes)) {
          if (typeof time === "string") {
            const [hours, minutes] = time.split(":").map(Number);
            const prayerTimeDate = new Date();
            prayerTimeDate.setHours(hours, minutes, 0, 0);
            prayerTimeDate.setSeconds(0, 0); // Pastikan detik dan milidetik di-reset

            const diff = prayerTimeDate.getTime() - now.getTime();

            if (diff >= 0 && diff < 60000) {
              // Jika dalam 1 menit
              vscode.window.showInformationMessage(
                `Waktunya salat ${prayer}! woiii!!!`,
                { modal: true }
              );
              showAnimeImage(context, prayer);
              break; // Keluar dari loop setelah notifikasi ditampilkan
            }
          }
        }
      }, 120000); // Cek setiap 60 detik (1 menit)
    } else {
      vscode.window.showErrorMessage("Format data waktu salat tidak valid.");
    }
  } catch (error: any) {
    console.error("Error saat mendapatkan data waktu salat:", error);
    vscode.window.showErrorMessage(
      `Gagal mendapatkan data waktu salat: ${error.message || error}`
    );
  }
}

function convertToSelectedTimezone(
  timings: Record<string, string>,
  offset: number
) {
  const convertedTimes: Record<string, string> = {};
  for (const [prayer, time] of Object.entries(timings)) {
    let [hours, minutes] = time.split(":").map(Number);

    let convertedHours = hours + offset - 7;
    if (convertedHours >= 24) convertedHours -= 24;
    if (convertedHours < 0) convertedHours += 24;

    convertedTimes[prayer] = `${String(convertedHours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(2, "0")}`;
  }
  return convertedTimes;
}

// async function checkPrayerTimes(
//   context: vscode.ExtensionContext,
//   timezoneOffset: number
// ) {
//   const location = { latitude: -6.192538, longitude: 106.831918 };
//   const apiUrl = `https://api.aladhan.com/v1/timings?latitude=${location.latitude}&longitude=${location.longitude}&method=2`;

//   try {
//     const response = await fetch(apiUrl);
//     const data = await response.json();

//     console.log("Data dari API:", data); // Periksa struktur data API

//     if (isPrayerApiResponse(data)) {
//       const timings = data.data.timings;
//       console.log("Timings dari API:", timings);

//       const prayerTimes = convertToSelectedTimezone(timings, timezoneOffset);
//       console.log("Waktu Salat Setelah Konversi:", prayerTimes);

//       const now = new Date();
//       const prayerToTest = "Dhuhr"; // GANTI DENGAN NAMA SALAT YANG ADA DI DATA API!

//       if (
//         prayerTimes[prayerToTest] &&
//         typeof prayerTimes[prayerToTest] === "string"
//       ) {
//         const [hours, minutes] = prayerTimes[prayerToTest]
//           .split(":")
//           .map(Number);
//         const testTime = new Date(now);
//         testTime.setHours(hours, minutes, 0, 0);
//         testTime.setSeconds(now.getSeconds() + 5);

//         console.log(`Waktu Sekarang (Test): ${now.toTimeString()}`);
//         console.log(
//           `Waktu Salat ${prayerToTest} (Test): ${testTime.toTimeString()}`
//         );
//         const diff = testTime.getTime() - now.getTime();
//         console.log(`Selisih Waktu: ${diff}`);

//         if (diff >= 0) {
//           setTimeout(() => {
//             console.log(`Menampilkan webview untuk ${prayerToTest}`); // Pastikan ini muncul!
//             showAnimeImage(context, prayerToTest);
//           }, diff);
//         } else {
//           console.log("Waktu tes sudah lewat");
//         }
//       } else {
//         console.warn(`Waktu salat ${prayerToTest} tidak valid.`);
//       }
//     } else {
//       vscode.window.showErrorMessage("Format data waktu salat tidak valid.");
//     }
//   } catch (error: any) {
//     console.error("Error saat mendapatkan data waktu salat:", error);
//     vscode.window.showErrorMessage(
//       `Gagal mendapatkan data waktu salat: ${error.message || error}`
//     );
//   }
// }

// async function checkPrayerTimes(
//   context: vscode.ExtensionContext,
//   timezoneOffset: number
// ) {
//   const location = { latitude: -6.2088, longitude: 106.8456 }; // Contoh lokasi default (Jakarta)
//   const apiUrl = `https://api.aladhan.com/v1/timings?latitude=${location.latitude}&longitude=${location.longitude}&method=2`;

//   try {
//     const response = await fetch(apiUrl);
//     const data = await response.json();

//     // Pastikan data adalah jenis PrayerApiResponse
//     if (isPrayerApiResponse(data)) {
//       const timings = data.data.timings;

//       // Konversi waktu salat ke zona waktu yang dipilih
//       const prayerTimes = convertToSelectedTimezone(timings, timezoneOffset);

//       // Loop untuk mengecek waktu setiap menit
//       setInterval(() => {
//         // Fungsi setInterval yang direvisi
//         const now = new Date();
//         for (const [prayer, time] of Object.entries(prayerTimes)) {
//           if (typeof time === "string") {
//             const [hours, minutes] = time.split(":").map(Number);
//             const prayerTimeDate = new Date();
//             prayerTimeDate.setHours(hours, minutes, 0, 0);

//             console.log(`Waktu Sekarang: ${now.toTimeString()}`);
//             console.log(
//               `Waktu Salat ${prayer}: ${prayerTimeDate.toTimeString()}`
//             );
//             const diff = prayerTimeDate.getTime() - now.getTime();
//             console.log(`Selisih Waktu: ${diff}`);
//             if (diff >= 0 && diff < 60000) {
//               vscode.window.showInformationMessage(
//                 `Waktunya salat ${prayer}! Ayo segera salat!`,
//                 { modal: true }
//               );
//               showAnimeImage(context, prayer);
//               break;
//             }
//           }
//         }
//       }, 60000);
//     } else {
//       vscode.window.showErrorMessage("Format data waktu salat tidak valid.");
//     }
//   } catch (error: unknown) {
//     // Mengatasi error tipe unknown
//     if (error instanceof Error) {
//       vscode.window.showErrorMessage(
//         `Gagal mendapatkan data waktu salat: ${error.message}`
//       );
//     } else {
//       vscode.window.showErrorMessage("Gagal mendapatkan data waktu salat.");
//     }
//   }
// }

// Fungsi untuk memeriksa apakah data sesuai dengan tipe PrayerApiResponse
function isPrayerApiResponse(data: any): data is PrayerApiResponse {
  return data && data.data && typeof data.data.timings === "object";
}

// Fungsi untuk konversi waktu salat ke zona waktu yang dipilih
// function convertToSelectedTimezone(
//   timings: Record<string, string>,
//   offset: number
// ) {
//   const convertedTimes: Record<string, string> = {};
//   for (const [prayer, time] of Object.entries(timings)) {
//     const [hours, minutes] = time.split(":").map(Number);
//     let convertedHours = hours + offset - 7; // Default API menggunakan WIB (GMT+7)
//     if (convertedHours >= 24) convertedHours -= 24;
//     if (convertedHours < 0) convertedHours += 24;
//     convertedTimes[prayer] = `${String(convertedHours).padStart(
//       2,
//       "0"
//     )}:${String(minutes).padStart(2, "0")}`;
//   }
//   return convertedTimes;
// }

// Fungsi untuk konversi waktu salat dan simulasi waktu
// function convertToSelectedTimezone(
//   timings: Record<string, string>,
//   offset: number
// ) {
//   const convertedTimes: Record<string, string> = {}; // Tipe yang lebih tepat
//   const now = new Date();

//   for (const [prayer, time] of Object.entries(timings)) {
//     let [hours, minutes] = time.split(":").map(Number);

//     // Konversi jam berdasarkan offset timezone
//     let convertedHours = hours + offset - 7; // Default API menggunakan WIB (GMT+7)
//     if (convertedHours >= 24) convertedHours -= 24;
//     if (convertedHours < 0) convertedHours += 24;

//     // Simulasi: Buat objek Date baru untuk waktu salat yang sudah dikonversi
//     const prayerTimeDate = new Date(now);
//     prayerTimeDate.setHours(convertedHours, minutes, 0, 0); // Set jam, menit, detik, dan milidetik

//     // Tambahkan 1 menit untuk simulasi
//     prayerTimeDate.setMinutes(prayerTimeDate.getMinutes() + 1);

//     // Format kembali ke string HH:mm
//     const simulatedHours = String(prayerTimeDate.getHours()).padStart(2, "0");
//     const simulatedMinutes = String(prayerTimeDate.getMinutes()).padStart(
//       2,
//       "0"
//     );
//     convertedTimes[prayer] = `${simulatedHours}:${simulatedMinutes}`;
//   }

//   return convertedTimes;
// }

function showAnimeImage(context: vscode.ExtensionContext, prayer: string) {
  const panel = vscode.window.createWebviewPanel(
    "prayerTime",
    `Waktunya Salat ${prayer}!`,
    {
      viewColumn: vscode.ViewColumn.Two,
      preserveFocus: false,
    },
    {
      enableScripts: true, // WAJIB diaktifkan untuk menjalankan JavaScript di webview
      localResourceRoots: [context.extensionUri], // Penting untuk mengakses resource lokal
    }
  );

  panel.webview.html = getWebviewContent(
    panel.webview,
    context.extensionUri,
    prayer
  );

  setTimeout(() => {
    panel.dispose();
  }, 5000); // 5 detik
}

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  prayer: string
) {
  const toolkitUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "toolkit.min.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "style.css")
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "script.js")
  );
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "codicons.css")
  );
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cat Coding</title>
        <script type="module" src="${toolkitUri}"></script>
        <link href="${styleUri}" rel="stylesheet" />
        <link href="${codiconsUri}" rel="stylesheet" />
    </head>
    <body>
    <div class="container">
        <h1>Waktunya Salat ${prayer} Sayanggg..</h1>
        <img id="prayerImage" src="https://res.cloudinary.com/djsdnb4td/image/upload/v1737186164/kitakita-Photoroom_g3vn15.png" alt="Ilustrasi Salat" />
        <p>Ayo cepetan salat! Jangan lupa niat yang baik yaaa</p>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        // Mendapatkan gambar yang tersimpan dari local storage
        const storedImage = vscode.getState<string>('customPrayerImage');
if (storedImage) {
    document.getElementById('prayerImage').src = storedImage;
}

        window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
        case 'setImage':
            vscode.getState().update('customPrayerImage', message.value);
            document.getElementById('prayerImage').src = message.value;
            break;
    }
});
    </script>
    </body>
    </html>`;
}

// Fungsi untuk memilih gambar dari file lokal
async function chooseImage(context: vscode.ExtensionContext) {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: "Pilih Gambar",
    filters: {
      Images: ["png", "jpg", "jpeg", "gif"],
    },
  };

  const fileUri = await vscode.window.showOpenDialog(options);
  if (fileUri && fileUri[0]) {
    if (panel) {
      panel.webview.postMessage({
        command: "setImage",
        value: fileUri[0].toString(),
      });
    }
  }
}

let panel: vscode.WebviewPanel | undefined = undefined;

export function deactivate() {}
