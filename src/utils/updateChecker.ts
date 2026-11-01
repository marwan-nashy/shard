export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
  formattedSize: string;
  type: "windows-installer" | "windows-portable" | "linux" | "web" | "other";
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  releaseUrl: string;
  assets: ReleaseAsset[];
}

export const CURRENT_VERSION = "0.2.0";
const GITHUB_REPO = "marwan-nashy/shard";
const AUTO_CHECK_KEY = "shard_auto_check_updates";
const LAST_CHECKED_KEY = "shard_last_checked_update";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function parseAssetType(name: string): ReleaseAsset["type"] {
  const lower = name.toLowerCase();
  if (lower.includes("setup.exe") || lower.endsWith(".msi")) return "windows-installer";
  if (lower.includes("portable.exe")) return "windows-portable";
  if (lower.endsWith(".appimage") || lower.endsWith(".deb") || lower.endsWith(".tar.gz")) return "linux";
  if (lower.includes("web") || lower.endsWith(".zip")) return "web";
  return "other";
}

/**
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim();
  const clean2 = v2.replace(/^v/, "").trim();

  const parts1 = clean1.split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = clean2.split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const a = parts1[i] ?? 0;
    const b = parts2[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check updates (HTTP ${response.status})`);
  }

  const data = await response.json();
  const latestTag = (data.tag_name || "").replace(/^v/, "").trim();
  const hasUpdate = compareSemver(latestTag, CURRENT_VERSION) > 0;

  const assets: ReleaseAsset[] = Array.isArray(data.assets)
    ? data.assets.map((a: any) => ({
        name: a.name || "Asset",
        downloadUrl: a.browser_download_url || "",
        size: a.size || 0,
        formattedSize: formatBytes(a.size || 0),
        type: parseAssetType(a.name || ""),
      }))
    : [];

  const updateInfo: UpdateInfo = {
    hasUpdate,
    currentVersion: CURRENT_VERSION,
    latestVersion: latestTag || CURRENT_VERSION,
    releaseName: data.name || `Shard v${latestTag}`,
    releaseNotes: data.body || "No changelog provided.",
    publishedAt: data.published_at ? new Date(data.published_at).toLocaleDateString() : "",
    releaseUrl: data.html_url || `https://github.com/${GITHUB_REPO}/releases`,
    assets,
  };

  try {
    localStorage.setItem(LAST_CHECKED_KEY, Date.now().toString());
  } catch {}

  return updateInfo;
}

export function isAutoCheckEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUTO_CHECK_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setAutoCheckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_CHECK_KEY, enabled.toString());
  } catch {}
}

export function getLastCheckedTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(LAST_CHECKED_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}
