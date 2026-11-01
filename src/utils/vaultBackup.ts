import JSZip from "jszip";
import { appInvoke as invoke, isTauri } from "../backend";
import { FileNode } from "../types";

export async function exportVaultAsZip(vaultPath: string | null): Promise<void> {
  const zip = new JSZip();

  if (!isTauri()) {
    // In-Browser Web App Mode: read from virtual storage
    const stored = localStorage.getItem("shard_web_vault_files");
    if (stored) {
      try {
        const files: { path: string; name: string; isDir: boolean; content: string }[] = JSON.parse(stored);
        files.forEach((f) => {
          if (!f.isDir) {
            // Strip vault root prefix if present
            const cleanPath = f.path.replace(/^Web Demo Vault[\\/]/, "");
            zip.file(cleanPath, f.content);
          }
        });
      } catch (e) {
        console.error("Failed to parse web vault files for backup", e);
      }
    }
  } else if (vaultPath) {
    // Desktop Tauri Mode: scan vault and read each file
    const rootVaultPath = vaultPath;
    const nodes = await invoke<FileNode[]>("scan_vault", { vaultPath });

    async function collectFiles(nodeList: FileNode[]) {
      for (const node of nodeList) {
        if (node.is_dir) {
          await collectFiles(node.children);
        } else {
          try {
            const content = await invoke<string>("read_file_content", { filePath: node.path });
            const relPath = node.path.replace(rootVaultPath, "").replace(/^[\\/]/, "");
            zip.file(relPath, content);
          } catch (e) {
            console.error(`Failed to read file ${node.path} for zip export:`, e);
          }
        }
      }
    }

    await collectFiles(nodes);
  }

  // Generate ZIP blob and trigger browser download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const vaultName = vaultPath ? vaultPath.split(/[\\/]/).pop() : "Shard-Vault";
  const dateStr = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `${vaultName}-Backup-${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
