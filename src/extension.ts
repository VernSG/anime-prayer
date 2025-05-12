import * as vscode from "vscode";
import fetch from "node-fetch";
import * as path from "path";
import * as fs from "fs";

// Tipe data untuk respons API
interface PrayerApiResponse {
  data: {
    timings: Record<string, string>; // Key adalah nama salat, value adalah waktu dalam format HH:mm
  };
}

export function activate(context: vscode.ExtensionContext) {
  // Pastikan folder media ada
  const mediaFolderPath = path.join(context.extensionUri.fsPath, "media");
  if (!fs.existsSync(mediaFolderPath)) {
    fs.mkdirSync(mediaFolderPath, { recursive: true });
  }

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

  // Periksa apakah zona waktu dan gambar sudah disimpan
  const savedTimezone = context.globalState.get<string>("selectedTimezone");
  const savedImage = context.globalState.get<string>("customPrayerImage");

  if (!savedImage) {
    vscode.window
      .showInformationMessage(
        "Anda harus memilih gambar terlebih dahulu untuk menampilkan notifikasi dengan gambar.",
        "Pilih Gambar"
      )
      .then((selection) => {
        if (selection === "Pilih Gambar") {
          chooseImage(context);
        }
      });
  }

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

// Fetch dinamis untuk waktu salat
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

      for (const [prayer, time] of Object.entries(prayerTimes)) {
        const [hours, minutes] = time.split(":").map(Number);
        const now = new Date();
        const prayerTime = new Date();

        prayerTime.setHours(hours, minutes, 0, 0);

        if (prayerTime > now) {
          const diff = prayerTime.getTime() - now.getTime();
          setTimeout(() => {
            vscode.window.showInformationMessage(`Waktunya salat ${prayer}!`, {
              modal: true,
            });
            showAnimeImage(context, prayer);
          }, diff);
          break;
        }
      }
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

// Fungsi untuk memeriksa apakah data sesuai dengan tipe PrayerApiResponse
function isPrayerApiResponse(data: any): data is PrayerApiResponse {
  return data && data.data && typeof data.data.timings === "object";
}

async function showAnimeImage(
  context: vscode.ExtensionContext,
  prayer: string
) {
  try {
    // Coba gunakan gambar kustom yang dipilih pengguna
    const savedImage = context.globalState.get<string>("customPrayerImage");

    // Gunakan gambar default jika gambar kustom tidak tersedia
    let imageUri;
    let defaultImageUsed = false;
    let imagePath = "";

    if (savedImage && fs.existsSync(savedImage)) {
      imageUri = vscode.Uri.file(savedImage);
      imagePath = savedImage;
      console.log(`Menggunakan gambar kustom: ${savedImage}`);
    } else {
      // Gunakan gambar default dari folder assets
      const defaultImagePath = path.join(
        context.extensionUri.fsPath,
        "assets",
        "ryotemplate-Photoroom.png"
      );

      console.log(`Mencoba menggunakan gambar default: ${defaultImagePath}`);

      if (fs.existsSync(defaultImagePath)) {
        imageUri = vscode.Uri.file(defaultImagePath);
        imagePath = defaultImagePath;
        defaultImageUsed = true;
        console.log(`Gambar default ditemukan: ${defaultImagePath}`);
      } else {
        console.error(
          `Gambar default tidak ditemukan di path: ${defaultImagePath}`
        );
        vscode.window.showErrorMessage(
          `Gambar default tidak ditemukan di: ${defaultImagePath}. Silakan pilih gambar terlebih dahulu.`
        );
        chooseImage(context);
        return;
      }
    }

    // Buat panel webview
    const panel = vscode.window.createWebviewPanel(
      "prayerTime",
      `Waktunya Salat ${prayer}!`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.dirname(imagePath)),
          context.extensionUri,
        ],
      }
    );

    const webview = panel.webview;
    const imageUrl = webview.asWebviewUri(imageUri);

    console.log(`URL gambar untuk webview: ${imageUrl.toString()}`);

    // Tampilkan HTML dengan gambar
    panel.webview.html = getWebviewContent(prayer, imageUrl.toString());

    // Tampilkan pesan jika menggunakan gambar default
    if (defaultImageUsed) {
      vscode.window.showInformationMessage(
        "Menggunakan gambar default. Anda dapat memilih gambar kustom dengan menjalankan perintah 'Pilih Gambar'."
      );
    }

    setTimeout(() => {
      panel.dispose();
    }, 5000);
  } catch (error: any) {
    console.error(`Error saat menampilkan gambar: ${error.message || error}`);
    vscode.window.showErrorMessage(
      `Error saat menampilkan gambar: ${error.message || error}`
    );
  }
}

function getWebviewContent(prayer: string, imageUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imageUrl.substring(
      0,
      imageUrl.indexOf("/", 8)
    )} https:; style-src 'unsafe-inline';">
    <title>Waktu Salat</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
        color: #333;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      img {
        max-width: 100%;
        max-height: 400px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #ddd;
      }
      h1 {
        color: #2c3e50;
      }
      p {
        margin-top: 20px;
        font-size: 16px;
      }
    </style>
</head>
<body>
    <div class="container">
        <h1>Waktunya Salat ${prayer} ..</h1>
        <img id="prayerImage" src="${imageUrl}" alt="Ilustrasi Salat" onerror="this.onerror=null; this.src='https://res.cloudinary.com/djsdnb4td/image/upload/v1738001789/ikuyoo-Photoroom_inenpd.png'; document.getElementById('error-message').style.display='block';" />
        <p>Ayo cepetan salat! Jangan lupa niat yang baik yaaa</p>
        <div id="error-message" style="display: none; color: red;">
          Gambar lokal tidak dapat dimuat, menggunakan gambar cadangan.
        </div>
    </div>
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
    const imagePath = fileUri[0].fsPath;
    context.globalState.update("customPrayerImage", imagePath);
    vscode.window.showInformationMessage(
      `Gambar berhasil disimpan: ${imagePath}`
    );

    // Tampilkan preview gambar yang baru dipilih
    showAnimeImage(context, "Test");
  }
}

export function deactivate() {}
