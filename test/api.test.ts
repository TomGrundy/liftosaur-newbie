import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiftosaurApiError, LiftosaurClient } from "../src/api/liftosaur";

const KEY = "lftsk_testkey";
const BASE = "https://www.liftosaur.com/api/v1";
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  delete process.env.LIFTOSAUR_API_BASE;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("LiftosaurClient", () => {
  it("rejects keys without the lftsk_ prefix", () => {
    expect(() => new LiftosaurClient({ apiKey: "abc" })).toThrow(/lftsk_/);
  });

  it("createProgram posts JSON with auth headers", async () => {
    fetchMock.mockResolvedValue(reply(201, { data: { id: "p1", name: "N", text: "T" } }));
    const res = await new LiftosaurClient({ apiKey: KEY }).createProgram({ name: "N", text: "T" });
    expect(res.id).toBe("p1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/programs`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.headers["X-Liftosaur-Device-Id"]).toBe("liftosaur-newbie-cli");
    expect(JSON.parse(init.body)).toEqual({ name: "N", text: "T" });
  });

  it("lists, gets, updates and gets stats on the right endpoints", async () => {
    const c = new LiftosaurClient({ apiKey: KEY });
    fetchMock.mockResolvedValueOnce(reply(200, { data: { programs: [{ id: "a", name: "A" }] } }));
    expect(await c.listPrograms()).toEqual([{ id: "a", name: "A" }]);
    fetchMock.mockResolvedValueOnce(reply(200, { data: { id: "a", name: "A", text: "x" } }));
    await c.getProgram("a");
    fetchMock.mockResolvedValueOnce(reply(200, { data: { id: "a", name: "B", text: "y" } }));
    await c.updateProgram("a", { text: "y", name: "B" });
    fetchMock.mockResolvedValueOnce(reply(200, { data: {} }));
    await c.programStats("z");
    const calls = fetchMock.mock.calls.map(([u, i]) => [i.method, u, i.body]);
    expect(calls).toEqual([
      ["GET", `${BASE}/programs`, undefined],
      ["GET", `${BASE}/programs/a`, undefined],
      ["PUT", `${BASE}/programs/a`, JSON.stringify({ text: "y", name: "B" })],
      ["POST", `${BASE}/program-stats`, JSON.stringify({ programText: "z" })],
    ]);
  });

  it("honours LIFTOSAUR_API_BASE", async () => {
    process.env.LIFTOSAUR_API_BASE = "http://localhost:9/api/v1/";
    fetchMock.mockResolvedValue(reply(200, { data: { programs: [] } }));
    await new LiftosaurClient({ apiKey: KEY }).listPrograms();
    expect(fetchMock.mock.calls[0]![0]).toBe("http://localhost:9/api/v1/programs");
  });

  it("maps 401", async () => {
    fetchMock.mockResolvedValue(reply(401, { error: { code: "unauthorized", message: "nope" } }));
    const e = await new LiftosaurClient({ apiKey: KEY }).listPrograms().catch((x) => x);
    expect(e).toBeInstanceOf(LiftosaurApiError);
    expect(e.status).toBe(401);
    expect(e.code).toBe("unauthorized");
    expect(e.message).toMatch(/lftsk_/);
    expect(e.message).not.toContain(KEY);
  });

  it("maps 403", async () => {
    fetchMock.mockResolvedValue(reply(403, { error: { code: "subscription_required", message: "Active subscription required" } }));
    const e = await new LiftosaurClient({ apiKey: KEY }).listPrograms().catch((x) => x);
    expect(e.code).toBe("subscription_required");
    expect(e.message).toMatch(/Premium/);
  });

  it("maps 422 with line details and the offending line", async () => {
    const details = [{ line: 3, offset: 1, message: "Unknown exercise: Barbell Curl" }];
    fetchMock.mockResolvedValue(reply(422, { error: { code: "parse_error", message: "Failed to parse program", details } }));
    const text = "# Week 1\n## Day 1\nBarbell Curl / 3x8\n";
    const e = await new LiftosaurClient({ apiKey: KEY }).createProgram({ name: "x", text }).catch((x) => x);
    expect(e.status).toBe(422);
    expect(e.details).toEqual(details);
    expect(e.message).toContain("line 3");
    expect(e.message).toContain("Barbell Curl / 3x8");
  });
});
