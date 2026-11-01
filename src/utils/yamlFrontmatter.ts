import { FrontmatterProperty } from "../types";

export interface ParsedFrontmatter {
  hasFrontmatter: boolean;
  properties: FrontmatterProperty[];
  body: string;
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {
      hasFrontmatter: false,
      properties: [],
      body: markdown,
    };
  }

  const rawYaml = match[1];
  const body = markdown.slice(match[0].length);
  const properties: FrontmatterProperty[] = [];

  const lines = rawYaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let valStr = line.slice(colonIdx + 1).trim();

    // Check array in bracket [a, b]
    if (valStr.startsWith("[") && valStr.endsWith("]")) {
      const items = valStr
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      properties.push({
        key,
        value: items,
        type: key.toLowerCase() === "tags" ? "tags" : "text",
      });
      continue;
    }

    // Check boolean
    if (valStr.toLowerCase() === "true" || valStr.toLowerCase() === "false") {
      properties.push({
        key,
        value: valStr.toLowerCase() === "true",
        type: "checkbox",
      });
      continue;
    }

    // Check number
    if (/^-?\d+(\.\d+)?$/.test(valStr)) {
      properties.push({
        key,
        value: Number(valStr),
        type: "number",
      });
      continue;
    }

    // Clean quotes
    valStr = valStr.replace(/^["']|["']$/g, "");
    properties.push({
      key,
      value: valStr,
      type: /^\d{4}-\d{2}-\d{2}$/.test(valStr) ? "date" : "text",
    });
  }

  return {
    hasFrontmatter: true,
    properties,
    body,
  };
}

export function serializeFrontmatter(properties: FrontmatterProperty[], body: string): string {
  if (properties.length === 0) return body;

  const lines: string[] = ["---"];
  for (const prop of properties) {
    if (Array.isArray(prop.value)) {
      lines.push(`${prop.key}: [${prop.value.join(", ")}]`);
    } else if (typeof prop.value === "boolean") {
      lines.push(`${prop.key}: ${prop.value}`);
    } else if (typeof prop.value === "number") {
      lines.push(`${prop.key}: ${prop.value}`);
    } else {
      lines.push(`${prop.key}: ${prop.value || ""}`);
    }
  }
  lines.push("---");
  lines.push("");

  return `${lines.join("\n")}${body.startsWith("\n") ? body.slice(1) : body}`;
}
