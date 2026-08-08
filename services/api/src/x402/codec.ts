export function b64json(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

export function unb64json<T = unknown>(value: string): T {
  const json = Buffer.from(value, "base64").toString("utf8");
  return JSON.parse(json) as T;
}
