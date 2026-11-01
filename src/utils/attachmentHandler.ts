import { appInvoke as invoke } from "../backend";

export function generateAttachmentFilename(originalName: string, prefix = "Pasted image"): string {
  const ext = originalName.split(".").pop() || "png";
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${prefix} ${dateStr}.${ext}`;
}

export async function saveAttachment(
  file: File,
  vaultPath: string | null
): Promise<{ filename: string; relativePath: string; markdownLink: string; dataUrl: string }> {
  const filename = generateAttachmentFilename(file.name);
  const relativePath = `attachments/${filename}`;

  // Read file as ArrayBuffer & Base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = file.type || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // If in desktop Tauri mode and vaultPath is available, save file to disk
  if (vaultPath) {
    try {
      // Ensure attachments folder exists
      const attachmentsFolder = `${vaultPath}/attachments`;
      await invoke("create_folder", {
        vaultPath,
        parentFolder: null,
        name: "attachments",
      }).catch(() => {});

      // Save attachment
      const filePath = `${attachmentsFolder}/${filename}`;
      // In Tauri backend, write_file_content accepts string; we can store base64 or write directly
      await invoke("write_file_content", {
        filePath,
        content: dataUrl,
      }).catch(async () => {
        // Fallback save in localStorage cache for web
        localStorage.setItem(`shard_asset_${relativePath}`, dataUrl);
      });
    } catch {
      // Fallback in web/browser sandbox
      try {
        localStorage.setItem(`shard_asset_${relativePath}`, dataUrl);
      } catch {}
    }
  } else {
    try {
      localStorage.setItem(`shard_asset_${relativePath}`, dataUrl);
    } catch {}
  }

  const markdownLink = `![[${relativePath}]]`;

  return {
    filename,
    relativePath,
    markdownLink,
    dataUrl,
  };
}

export function resolveAttachmentUrl(linkPath: string, vaultPath?: string | null): string {
  // Check if link is an absolute URL
  if (linkPath.startsWith("http://") || linkPath.startsWith("https://") || linkPath.startsWith("data:")) {
    return linkPath;
  }

  // Check localStorage asset cache
  const cached = localStorage.getItem(`shard_asset_${linkPath}`);
  if (cached) return cached;

  // In Tauri, convert local path or return relative
  if (vaultPath) {
    return `asset://localhost/${vaultPath.replace(/\\/g, "/")}/${linkPath.replace(/^[\/\\]/, "")}`;
  }

  return linkPath;
}
