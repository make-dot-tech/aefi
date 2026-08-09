/** Parse ERC-8004 agentURI into display fields for the evidence graph. */

export interface ParsedAgentUri {
  display_name: string | null;
  blurb: string | null;
  capabilities: string[];
  capability_text: string | null;
  role: string | null;
}

export function parseAgentUri(uri: unknown): ParsedAgentUri {
  const empty: ParsedAgentUri = {
    display_name: null,
    blurb: null,
    capabilities: [],
    capability_text: null,
    role: null,
  };
  if (typeof uri !== "string" || !uri.trim()) return empty;

  let json: Record<string, unknown> | null = null;
  const raw = uri.trim();

  if (raw.startsWith("data:application/json;base64,")) {
    try {
      const b64 = raw.slice("data:application/json;base64,".length);
      json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      return empty;
    }
  } else if (raw.startsWith("data:application/json,")) {
    try {
      json = JSON.parse(
        decodeURIComponent(raw.slice("data:application/json,".length)),
      ) as Record<string, unknown>;
    } catch {
      try {
        json = JSON.parse(
          raw.slice("data:application/json,".length),
        ) as Record<string, unknown>;
      } catch {
        return empty;
      }
    }
  } else if (raw.startsWith("{")) {
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return empty;
    }
  } else {
    // ipfs:// or https:// — keep a short marker for search text
    return {
      ...empty,
      capability_text: `agent metadata ${raw.slice(0, 120)}`,
    };
  }

  if (!json) return empty;

  const name =
    str(json.name) ?? str(json.display_name) ?? str(json.title) ?? null;
  const blurb =
    str(json.description) ??
    str(json.blurb) ??
    str((json.scenario as Record<string, unknown> | undefined)?.title) ??
    null;
  const role = str(json.role);

  const caps = new Set<string>();
  for (const c of asList(json.skills)) caps.add(c.toLowerCase());
  for (const c of asList(json.capabilities)) caps.add(c.toLowerCase());
  for (const c of asList(
    (json.scenario as Record<string, unknown> | undefined)?.protocols,
  )) {
    caps.add(c.toLowerCase().replace(/\s+/g, "-"));
  }
  if (role) caps.add(role.toLowerCase());
  const domain = (json.scenario as Record<string, unknown> | undefined)
    ?.domain as Record<string, unknown> | undefined;
  if (domain?.id) caps.add(String(domain.id).toLowerCase());
  if (domain?.name) {
    caps.add(
      String(domain.name)
        .toLowerCase()
        .replace(/\s+/g, "-"),
    );
  }

  const capabilities = [...caps].filter(Boolean).slice(0, 24);
  const capability_text = [
    name,
    blurb,
    role ? `role ${role}` : null,
    capabilities.length ? `skills ${capabilities.join(" ")}` : null,
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 2000);

  return {
    display_name: name,
    blurb,
    capabilities,
    capability_text: capability_text || null,
    role,
  };
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}
