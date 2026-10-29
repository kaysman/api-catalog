import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ExpressApiCatalog } from "../src/express.js";
import { s } from "../src/spec/index.js";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  const catalog = new ExpressApiCatalog(app, { title: "Users API", version: "1.2.3" });

  catalog.spec.schema("User", s.object({ id: s.string(), name: s.string() }, ["id", "name"]));

  catalog.get(
    "/users/:id",
    {
      summary: "Get user",
      tags: ["Users"],
      parameters: [catalog.pathParam("id", s.string())],
      responses: { 200: catalog.jsonResponse("User", s.ref("User")) },
    },
    (req, res) => {
      res.json({ id: req.params.id, name: "Alice" });
    },
  );

  catalog.mount();

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("ExpressApiCatalog", () => {
  it("still serves the documented route", async () => {
    const res = await fetch(`${base}/users/42`);
    expect(await res.json()).toEqual({ id: "42", name: "Alice" });
  });

  it("serves the catalog UI at /docs by default", async () => {
    const res = await fetch(`${base}/docs`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(await res.text()).toContain("<title>Users API</title>");
  });

  it("serves the generated OpenAPI document", async () => {
    const res = await fetch(`${base}/docs/default.json`);
    expect(res.status).toBe(200);
    const doc: any = await res.json();
    expect(doc.info).toMatchObject({ title: "Users API", version: "1.2.3" });
    expect(doc.paths["/users/{id}"].get).toMatchObject({ summary: "Get user", tags: ["Users"] });
    expect(doc.components.schemas.User.required).toEqual(["id", "name"]);
  });
});
