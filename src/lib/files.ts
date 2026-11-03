export function download(name: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // Revogar na hora cancela o download em alguns navegadores (Safari/Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareOrDownload(
  name: string,
  content: string,
  title = name,
  type = "application/json",
): Promise<"shared" | "downloaded"> {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator) {
      const file = new File([content], name, { type });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] });
        return "shared";
      }
    }
  } catch {
    // Fallback to regular download when user cancels or Web Share fails
  }
  download(name, content, type);
  return "downloaded";
}

export function resizeImageFile(file: File, maxDim = 720, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
