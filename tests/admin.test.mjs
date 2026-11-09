import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("admin page has private login and lists", () => {
  const html = readFileSync("public/admin.html", "utf8");
  assert.match(html, /loginForm/);
  assert.match(html, /enquiryRows/);
  assert.match(html, /meetingRows/);
});
test("public form shows meeting preferences and sends to API", () => {
  const script = readFileSync("public/app.js", "utf8");
  assert.match(script, /meetingPreferences/);
  assert.match(script, /\/api\/contact/);
});
