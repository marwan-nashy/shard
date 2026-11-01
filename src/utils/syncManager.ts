import { SyncConfig } from "../types";

const SYNC_CONFIG_KEY = "shard_sync_config";

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  provider: "none",
  autoSync: false,
  syncIntervalMinutes: 10,
  webdavUrl: "",
  webdavUsername: "",
  webdavPassword: "",
  gitRemoteUrl: "",
  gitBranch: "main",
  gitToken: "",
  lastSyncStatus: "idle",
};

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return DEFAULT_SYNC_CONFIG;
    return { ...DEFAULT_SYNC_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SYNC_CONFIG;
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save sync config:", err);
  }
}

export async function testWebDavConnection(config: SyncConfig): Promise<{ success: boolean; message: string }> {
  if (!config.webdavUrl) {
    return { success: false, message: "WebDAV URL is empty" };
  }

  try {
    const auth = btoa(`${config.webdavUsername}:${config.webdavPassword}`);
    const res = await fetch(config.webdavUrl, {
      method: "PROPFIND",
      headers: {
        Authorization: `Basic ${auth}`,
        Depth: "0",
      },
    });

    if (res.ok || res.status === 207) {
      return { success: true, message: "Connected successfully to WebDAV server!" };
    }
    return { success: false, message: `Server responded with HTTP ${res.status} (${res.statusText})` };
  } catch (err: any) {
    return { success: false, message: `Network error: ${err?.message || "Failed to fetch"}` };
  }
}

export async function performWebDavSync(
  config: SyncConfig,
  vaultNotes: { path: string; content?: string }[]
): Promise<{ success: boolean; message: string }> {
  if (!config.webdavUrl) {
    return { success: false, message: "No WebDAV server configured." };
  }

  const auth = btoa(`${config.webdavUsername}:${config.webdavPassword}`);
  let uploaded = 0;

  try {
    const baseUrl = config.webdavUrl.replace(/\/$/, "");

    for (const note of vaultNotes) {
      const filename = note.path.split(/[\\/]/).pop() || "note.md";
      const targetUrl = `${baseUrl}/${encodeURIComponent(filename)}`;
      const content = note.content || "";

      const res = await fetch(targetUrl, {
        method: "PUT",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "text/markdown; charset=utf-8",
        },
        body: content,
      });

      if (res.ok || res.status === 201 || res.status === 204) {
        uploaded++;
      }
    }

    const result = {
      success: true,
      message: `Synchronized ${uploaded} note(s) to WebDAV successfully.`,
    };

    saveSyncConfig({
      ...config,
      lastSyncTime: Date.now(),
      lastSyncStatus: "success",
      lastSyncMessage: result.message,
    });

    return result;
  } catch (err: any) {
    const msg = `Sync failed: ${err?.message || "Network error"}`;
    saveSyncConfig({
      ...config,
      lastSyncTime: Date.now(),
      lastSyncStatus: "error",
      lastSyncMessage: msg,
    });
    return { success: false, message: msg };
  }
}
