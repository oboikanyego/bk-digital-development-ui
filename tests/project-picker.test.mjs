import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=path=>readFileSync("public/"+path,"utf8");

test("project picker retains native form fields and progressive enhancement",()=>{
  const html=file("contact/index.html");
  const js=file("project-picker.js");
  for(const id of ["projectTypeNative","projectTypeTrigger","projectTypePanel","projectTypeOptions","projectTypeSearch","projectTypeBackdrop","projectTypeError"]){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/id="projectTypeNative" name="projectType" required/);
  assert.match(html,/\/project-picker\.css/);
  assert.match(html,/\/project-picker\.js/);
  assert.ok(html.indexOf('/project-picker.js')<html.indexOf('/app.js'),"picker boots before submit handler");
  assert.match(js,/native\.dispatchEvent\(new Event\("change"/);
  assert.match(js,/event\.stopImmediatePropagation\(\)/);
  assert.match(js,/form\.addEventListener\("reset"/);
  assert.match(js,/field\.classList\.add\("is-enhanced"\)/);
  assert.match(file("app.js"),/Object\.fromEntries\(new FormData\(form\)\.entries\(\)\)/);
});

test("responsive picker has scrollable listbox and accessible mobile modal",()=>{
  const js=file("project-picker.js");
  const css=file("project-picker.css");
  assert.match(js,/aria-selected/);
  assert.match(js,/aria-modal/);
  assert.match(js,/ArrowDown/);
  assert.match(js,/Escape/);
  assert.match(js,/role", "option"/);
  assert.match(js,/setAttribute\("aria-invalid"/);
  assert.match(css,/@media \(max-width:700px\)/);
  assert.match(css,/position: fixed/);
  assert.match(css,/overscroll-behavior: contain/);
  assert.match(css,/overflow-y: auto/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test("project type values match API choices exactly and never use unsafe generated markup",()=>{
  const html=file("contact/index.html");
  const raw=html.match(/<select id="projectTypeNative"[\s\S]*?<\/select>/)?.[0];
  assert.ok(raw);
  const choices=[...raw.matchAll(/<option(?: value="[^"]*")?>([^<]+)<\/option>/g)].map(m=>m[1]);
  assert.equal(choices.length,12);
  for(const name of ["Starter website","Business website","Booking website/system","Online store","Mobile app","Custom business system","Not sure yet"])assert.ok(choices.includes(name));
  const js=file("project-picker.js");
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
  assert.match(js,/createElement/);
  assert.match(js,/textContent = entry\.title/);
});
