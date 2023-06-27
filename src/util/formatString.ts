export function formatString(str: string, params: Record<string, string>) {
  for (const key in params) {
    if (!key) continue;
    str = str.replace(new RegExp(`(?<!\\\\){{${key}}}`, "g"), params[key]);
  }
  return str;
}
