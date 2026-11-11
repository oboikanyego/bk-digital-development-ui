import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const home = readFileSync("public/index.html", "utf8");
const css = readFileSync("public/homepage-next.css", "utf8");
const siteView = readFileSync("public/site-view.js", "utf8");

test("IT-first homepage has actionable above-the-fold conversion and real product proof", () => {
  assert.match(home, /class="home-next"/);
  assert.match(home, /id="homeHeroTitle"/);
  assert.match(home, /href="\/homepage-next\.css"/);
  assert.match(home, /Request a project quote/);
  assert.match(home, /href="\/contact\/"/);
  assert.match(home, /href="\/portfolio\/"/);
  assert.match(home, /home-primary-shot/);
  assert.match(home, /alt="MzansiRent rental management platform screenshot"/);
  assert.match(home, /alt="KasiDrop e-commerce application screenshot"/);
  assert.match(home, /rel="noopener noreferrer"/);
  assert.match(home, /\/images\/projects\/mzansirent\.webp/);
  assert.match(home, /\/images\/projects\/kasidrop-live\.webp/);
  for (const image of ["mzansirent.webp", "kasidrop-live.webp"]) {
    assert.ok(statSync("public/images/projects/" + image).size > 10000);
  }
});

test("customer-focused sections and existing MongoDB-driven project grid remain intact", () => {
  for (const name of ["home-services", "home-outcomes", "studio-work", "home-process", "home-final-cta"]) {
    assert.ok(home.includes(name), name);
  }
  for (const target of ['class="case-grid"', 'class="studio-hero', 'class="hero-lead"', 'class="hero-actions"', 'class="btn btn-primary"']) {
    assert.ok(home.includes(target), target);
  }
  assert.match(siteView, /setTitle\("\.studio-hero h1"/);
  assert.match(siteView, /site\.projects\.filter\(p => p\.homeFeatured/);
  assert.match(siteView, /const container = \$\("\.studio-work \.case-grid"\)/);
  assert.doesNotMatch(home, /id="contactForm"/);
});

test("homepage-specific styling supports desktop, mobile and reduced motion without changing global stylesheets", () => {
  assert.match(css, /body\.home-next/);
  for (const max of [1240, 1100, 960, 700, 430]) assert.ok(css.includes("@media(max-width:" + max + "px)"));
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /home-next\.cms-managed/);
  assert.match(css, /home-hero \.hero-actions/);
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:\/\//);
});
