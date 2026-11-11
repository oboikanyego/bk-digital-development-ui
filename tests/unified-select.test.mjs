import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read = path => readFileSync("public/"+path,"utf8");

test("all pages with native and dynamically rendered selects load the shared picker", () => {
  const pages = [
    "contact/index.html",
    "admin/dashboard/index.html",
    "admin/crm/index.html",
    "admin/documents/index.html",
    "admin/email-templates/index.html",
    "admin/site-settings/index.html",
    "admin/content/index.html"
  ];
  for (const file of pages) {
    const html = read(file);
    assert.match(html,/\/unified-select\.css/,file);
    assert.match(html,/\/unified-select\.js/,file);
    assert.match(html,/\/service-health\.js/,file);
  }
  const contact = read("contact/index.html");
  assert.match(contact,/\/project-picker\.js/,"Project Type keeps its richer picker");
  for (const name of ["budget","contactMethod","timeline","projectType"])
    assert.match(contact,new RegExp('name="'+name+'"'));
});

test("enhancer excludes the project-type picker and preserves native form values",()=>{
  const js = read("unified-select.js");
  assert.match(js,/select\.closest\("#projectTypeField"\)/);
  assert.match(js,/select\.selectedIndex = entry\.index/);
  assert.match(js,/dispatchEvent\(new Event\("change", \{bubbles:true\}\)\)/);
  assert.match(js,/dispatchEvent\(new Event\("input", \{bubbles:true\}\)\)/);
  assert.match(js,/select\.form\?\.addEventListener\("reset"/);
  assert.match(js,/select\.addEventListener\("invalid"/);
  assert.match(js,/select\.disabled/);
  assert.match(js,/select\.getAttribute\("name"\)/);
  assert.doesNotMatch(js,/fetch\(/,"selecting cannot send network requests by itself");
});

test("dynamic CMS and admin selects are supported without string-based option injection",()=>{
  const js=read("unified-select.js");
  assert.match(js,/new MutationObserver/);
  assert.match(js,/observer\.observe\(document\.body/);
  assert.match(js,/record\.addedNodes/);
  assert.match(js,/textContent = entry\.text/);
  assert.match(js,/list\.replaceChildren\(\)/);
  assert.match(js,/dialog\.showModal\(\)/);
  assert.match(js,/dialog\.close\(\)/);
  assert.match(js,/aria-expanded/);
  assert.match(js,/aria-selected/);
  assert.match(js,/aria-labelledby/);
});

test("mobile bottom sheet is bounded, scrollable and respects reduced motion",()=>{
  const css=read("unified-select.css");
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/width:100vw!important/);
  assert.match(css,/height:min\(77dvh,680px\)!important/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.mdv-select-native/);
});
