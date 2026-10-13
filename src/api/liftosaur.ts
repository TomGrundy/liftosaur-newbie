export const DEFAULT_API_BASE = "https://www.liftosaur.com/api/v1";
export const DEVICE_ID = "liftosaur-newbie-cli";
export const KEY_PREFIX = "lftsk_";

export interface ApiErrorDetail {
  line: number;
  offset: number;
  message: string;
}

/** Error returned by (or while preparing a request to) the Liftosaur API. Never contains the API key. */
export class LiftosaurApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = [], programText?: string) {
    super(LiftosaurApiError.friendly(status, code, message, details, programText));
    this.name = "LiftosaurApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static friendly(status: number, code: string, message: string, details: ApiErrorDetail[], programText?: string): string {
    if (status === 401 || code === "unauthorized") {
      return `Unauthorized (401): the API key was rejected. Create one in the Liftosaur app under Me > API Keys; it must start with ${KEY_PREFIX}.`;
    }
    if (status === 403 || code === "subscription_required") {
      return "Subscription required (403): the Liftosaur API needs an active Premium subscription.";
    }
    if (status === 422 || code === "parse_error") {
      const src = programText?.replace(/\r\n?/g, "\n").split("\n");
      const lines = details.map((d) => {
        const srcLine = src?.[d.line - 1];
        return `  line ${d.line}${d.offset ? `:${d.offset}` : ""}: ${d.message}${srcLine !== undefined ? `\n      > ${srcLine.trim()}` : ""}`;
      });
      return `${message || "Failed to parse program"} (422)${lines.length ? "\n" + lines.join("\n") : ""}`;
    }
    return `${message} (${status}${code ? ` ${code}` : ""})`;
  }
}

export interface ProgramSummary {
  id: string;
  name: string;
  isCurrent?: boolean;
}
export interface ProgramFull extends ProgramSummary {
  text: string;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export function assertKeyFormat(key: string | undefined): asserts key is string {
  if (!key) {
    throw new LiftosaurApiError(401, "unauthorized", "No API key. Set LIFTOSAUR_API_KEY (env var or .env file).");
  }
  if (!key.startsWith(KEY_PREFIX)) {
    throw new LiftosaurApiError(401, "unauthorized", `API key must start with ${KEY_PREFIX}.`);
  }
}

export class LiftosaurClient {
  private readonly key: string;
  private readonly base: string;

  constructor(opts: ClientOptions) {
    assertKeyFormat(opts.apiKey);
    this.key = opts.apiKey;
    this.base = (opts.baseUrl ?? process.env.LIFTOSAUR_API_BASE ?? DEFAULT_API_BASE).replace(/\/+$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown, programText?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.key}`,
      "X-Liftosaur-Device-Id": DEVICE_ID,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await res.text();
    let json: any;
    try {
      json = raw ? JSON.parse(raw) : undefined;
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      const e = json?.error ?? {};
      throw new LiftosaurApiError(
        res.status,
        typeof e.code === "string" ? e.code : "",
        typeof e.message === "string" ? e.message : res.statusText || "Request failed",
        Array.isArray(e.details) ? e.details : [],
        programText,
      );
    }
    return (json?.data ?? json) as T;
  }

  async listPrograms(): Promise<ProgramSummary[]> {
    const data = await this.request<{ programs: ProgramSummary[] }>("GET", "/programs");
    return data.programs ?? [];
  }

  getProgram(id: string): Promise<ProgramFull> {
    return this.request("GET", `/programs/${encodeURIComponent(id)}`);
  }

  createProgram(p: { name: string; text: string }): Promise<{ id: string; name: string; text: string }> {
    return this.request("POST", "/programs", p, p.text);
  }

  updateProgram(id: string, p: { text: string; name?: string }): Promise<ProgramFull> {
    return this.request("PUT", `/programs/${encodeURIComponent(id)}`, p, p.text);
  }

  /** Validates (and analyses) program text without saving it. */
  programStats(programText: string): Promise<Record<string, unknown>> {
    return this.request("POST", "/program-stats", { programText }, programText);
  }
}
