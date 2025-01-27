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

  // let chooseImageCommand = vscode.commands.registerCommand(
  //   "animeprayer-notifier.chooseImage",
  //   () => {
  //     chooseImage(context);
  //   }
  // );
  // context.subscriptions.push(chooseImageCommand);

  // Periksa apakah zona waktu dan gambar sudah disimpan
  const savedTimezone = context.globalState.get<string>("selectedTimezone");
  const savedImage = context.globalState.get<string>("customPrayerImage");

  // if (!savedImage) {
  //   vscode.window.showErrorMessage(
  //     "Anda harus memilih gambar terlebih dahulu untuk menggunakan extension ini."
  //   );
  //   chooseImage(context);
  //   return;
  // }

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
            vscode.window.showInformationMessage(
              `Waktunya salat ${prayer}! woiii!!!`,
              { modal: true }
            );
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
  const savedImage = context.globalState.get<string>("customPrayerImage");
  if (!savedImage) {
    vscode.window.showErrorMessage(
      "Gambar belum disimpan. Silakan pilih gambar terlebih dahulu."
    );
    return;
  }

  const imageUri = vscode.Uri.file(savedImage);

  const panel = vscode.window.createWebviewPanel(
    "prayerTime",
    `Waktunya Salat ${prayer}!`,
    vscode.ViewColumn.Two, // Gunakan langsung ViewColumn
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(savedImage)
          .with({ scheme: "vscode-resource" })
          .with({
            path: vscode.Uri.file(savedImage)
              .path.split("/")
              .slice(0, -1)
              .join("/"),
          }),
      ],
    }
  );

  const webview = panel.webview;
  const imageUrl = webview.asWebviewUri(imageUri);

  panel.webview.html = getWebviewContent(
    webview,
    context.extensionUri,
    prayer,
    imageUrl.toString()
  );

  setTimeout(() => {
    panel.dispose();
  }, 5000);
}

function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  prayer: string,
  imageUrl: string
) {
  const toolkitUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "toolkit.min.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "style.css")
  );
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "codicons.css")
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Waktu Salat</title>
    <script type="module" src="${toolkitUri}"></script>
    <link href="${styleUri}" rel="stylesheet" />
    <link href="${codiconsUri}" rel="stylesheet" />
</head>
<body>
    <div class="container">
        <h1>Waktunya Salat ${prayer} Sayanggg..</h1>
        <img id="prayerImage" src="https://res.cloudinary.com/djsdnb4td/image/upload/v1738001789/ikuyoo-Photoroom_inenpd.png" alt="Ilustrasi Salat" />
        <p>Ayo cepetan salat! Jangan lupa niat yang baik yaaa</p>
    </div>
</body>
</html>`;
}

// Fungsi untuk memilih gambar dari file lokal
// async function chooseImage(context: vscode.ExtensionContext) {
//   const options: vscode.OpenDialogOptions = {
//     canSelectMany: false,
//     openLabel: "Pilih Gambar",
//     filters: {
//       Images: ["png", "jpg", "jpeg", "gif"],
//     },
//   };

//   const fileUri = await vscode.window.showOpenDialog(options);
//   if (fileUri && fileUri[0]) {
//     const imagePath = fileUri[0].fsPath;
//     context.globalState.update("customPrayerImage", imagePath);
//     vscode.window.showInformationMessage("Gambar berhasil disimpan.");
//   }
// }

export function deactivate() {}
