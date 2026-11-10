/* Public-site hydration: MongoDB is the source of truth; authored HTML is an offline/SEO fallback.
 * No privileged requests, third-party scripts, or browser-stored admin credentials. */
(() => {
  "use strict";
  const $ = sel => document.querySelector(sel);
  const all = sel => [...document.querySelectorAll(sel)];
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const safeUrl = (value, image = false) => {
    if (typeof value !== "string") return "";
    if (image && /^\/(?:brand-mark\.svg|images\/projects\/[a-z0-9/_-]+\.webp)$/.test(value)) return value;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return "";
      if (image && (url.hostname !== "res.cloudinary.com" || !/^\/[\w-]+\/image\/upload\//.test(url.pathname))) return "";
      return url.href;
    } catch { return ""; }
  };
  const setText = (sel, value) => { const node = $(sel); if (node && typeof value === "string") node.textContent = value; };
  const setTitle = (sel, first, second) => {
    const node = $(sel);
    if (!node) return;
    node.replaceChildren(document.createTextNode(first + " "));
    const highlight = document.createElement("span");
    highlight.textContent = second;
    node.appendChild(highlight);
  };
  const img = (url, alt, eager = false) => {
    const src = safeUrl(url, true);
    if (!src) return "";
    return '<img src="' + escape(src) + '" alt="' + escape(alt) +
      '" width="1200" height="750" loading="' + (eager ? "eager" : "lazy") +
      '" decoding="async">';
  };
  const imagePicture = project => {
    const mobile = safeUrl(project.mobileImageUrl, true);
    const desktop = safeUrl(project.imageUrl, true);
    if (!desktop) return '<div class="cms-image-empty">Screenshot coming soon</div>';
    return "<picture>" + (mobile ? '<source media="(max-width:560px)" srcset="' + escape(mobile) + '" type="image/webp">' : "") +
      img(desktop, project.name + " application screenshot", true) + "</picture>";
  };
  const live = project => safeUrl(project.liveUrl);
  const caseStudy = project => safeUrl(project.caseStudyUrl);
  const tags = project => Array.isArray(project.stack) ? project.stack.map(x => "<span>" + escape(x) + "</span>").join("") : "";

  function updateCompany(site) {
    const company = site.company;
    document.body.classList.add("cms-managed");
    if (/^#[a-f0-9]{6}$/i.test(company.accentColor)) document.documentElement.style.setProperty("--cms-accent", company.accentColor);
    all(".brand img.brand-mark").forEach(element => {
      const src = safeUrl(company.logoUrl, true);
      if (src) element.src = src;
    });
    const name = company.shortName.split(/\s+/);
    const tail = name.length > 1 ? name.pop() : "";
    all(".site-header .brand,.footer-grid .brand").forEach(node => {
      const strong = node.querySelector("strong"), small = node.querySelector("small");
      if (strong) strong.textContent = name.join(" ");
      if (small) small.textContent = tail;
    });
    const footer = $(".footer-bottom");
    if (footer) footer.textContent = "© " + new Date().getFullYear() + " " + company.name + " · " + company.location + ".";
    all('a[href^="mailto:"]').forEach(anchor => {
      anchor.href = "mailto:" + encodeURIComponent(company.email).replace("%40","@");
      if (anchor.textContent.includes("kanyiradipabe")) {
        const strong = anchor.querySelector("strong");
        if (strong) strong.textContent = company.email;
      }
    });
    const whatsapp = $("#whatsappLink");
    if (whatsapp) {
      if (company.whatsapp) whatsapp.href = "https://wa.me/" + company.whatsapp;
      else whatsapp.hidden = true;
    }
  }
  function updateHome(site) {
    if (!$(".studio-hero")) return;
    setText(".studio-hero .eyebrow", site.home.eyebrow);
    setTitle(".studio-hero h1", site.home.heading, site.home.highlight);
    setText(".studio-hero .hero-lead", site.home.description);
    const cta = $(".studio-hero .hero-actions .btn-primary");
    if (cta) cta.textContent = site.home.buttonText + " ↗";

    const featured = site.projects.filter(p => p.homeFeatured && p.visible);
    const list = featured.length ? featured : site.projects.filter(p => p.featured && p.visible);
    const container = $(".studio-work .case-grid");
    if (container) container.innerHTML = list.slice(0,6).map((p,i) => {
      const href = live(p) || "/portfolio/";
      return '<article class="case-card"><a class="case-visual screenshot" href="' + escape(href) +
        '" ' + (live(p) ? 'target="_blank" rel="noopener noreferrer"' : "") +
        ' aria-label="View ' + escape(p.name) + '">' + img(p.imageUrl,p.name + " project screenshot",true) +
        '</a><div class="case-meta"><span>' + escape(p.category.toUpperCase()) + '</span><span>' +
        String(i+1).padStart(2,"0") + " / " + String(Math.min(list.length,6)).padStart(2,"0") +
        '</span></div><h3>' + escape(p.name) + '</h3><p>' + escape(p.description) +
        '</p><a class="text-link" href="/portfolio/">Explore the project <b aria-hidden="true">↗</b></a></article>';
    }).join("");
  }
  function updateAbout(site) {
    setTitle(".about-hero h1",site.about.heading,site.about.highlight);
    setText(".about-hero .about-grid>div:first-child>p:not(.eyebrow)",site.about.intro);
    setTitle(".mission-section .section-heading h2",site.about.missionHeading,site.about.missionHighlight);
    setText(".mission-section .section-heading>p",site.about.missionDescription);
  }
  function updateServices(site) {
    const grid = $(".service-grid");
    if (!grid) return;
    grid.innerHTML = site.services.map((service,index)=>
      '<article class="service-card cms-service-card"><div class="cms-service-number">' +
      String(index+1).padStart(2,"0") + '</div><p class="card-no">' +
      escape(service.category.toUpperCase()) + '</p><h3>' + escape(service.title) +
      '</h3><p>' + escape(service.description) +
      '</p><a href="/contact/">Discuss your project ↗</a></article>').join("");
  }
  function updatePricing(site) {
    for (const [group,selector] of [["web","#web-pricing"],["app","#app-pricing"]]) {
      const container = $(selector);
      if (!container) continue;
      container.innerHTML = site.pricing.filter(p=>p.group===group).map((p,i)=>
        '<article class="price-card ' + (i===1?"featured":"") + '"><small>' + escape(p.name.toUpperCase()) +
        '</small><h3>' + escape(p.heading) +
        '</h3><div class="cms-price-price">' + escape(p.price) +
        '</div><ul class="cms-price-features">' + p.features.map(f=>"<li>" + escape(f) + "</li>").join("") +
        '</ul><a href="/contact/">Discuss package ↗</a></article>').join("");
    }
  }
  function updatePortfolio(site) {
    const featured = site.projects.filter(p=>p.featured);
    const extra = site.projects.filter(p=>!p.featured);
    const container = $(".project-showcase-list");
    if (container) container.innerHTML = featured.map((p,i)=>{
      const href = live(p)||"/contact/",study = caseStudy(p);
      return '<article class="project-showcase"><a class="project-showcase-visual" href="' +
        escape(href) + '" ' + (live(p)?'target="_blank" rel="noopener noreferrer"':'') +
        ' aria-label="Open ' + escape(p.name) + '">' + img(p.imageUrl,p.name+" screenshot",i===0) +
        '<span class="visual-caption">' + escape(p.name) + ' / Project screenshot <b>↗</b></span></a>' +
        '<div class="project-showcase-detail"><span class="project-index">' +
        String(i+1).padStart(2,"0") + ' / ' + escape(p.category.toUpperCase()) +
        '</span><h3>' + escape(p.name) + '</h3><p class="project-standfirst">' + escape(p.description) + '</p>' +
        (p.problem || p.approach?'<dl class="project-facts">' +
          (p.problem?'<div><dt>Problem</dt><dd>'+escape(p.problem)+'</dd></div>':'')+
          (p.approach?'<div><dt>Approach</dt><dd>'+escape(p.approach)+'</dd></div>':'')+'</dl>':'')+
        '<div class="project-tags">' + tags(p) + '</div><div class="project-actions">' +
        (live(p)?'<a class="project-action-primary" href="'+escape(href)+'" target="_blank" rel="noopener noreferrer">Visit project ↗</a>':'')+
        (study?'<a class="text-link" href="'+escape(study)+'" target="_blank" rel="noopener noreferrer">Read case study ↗</a>':'') +
        '</div></div></article>';
    }).join("");
    const more = $(".more-projects-grid");
    if (more) more.innerHTML = extra.map(p=>{
      const url=live(p)||"/contact/";
      return '<article class="more-project"><a class="more-project-art screenshot" href="' +
        escape(url) + '"' + (live(p)?' target="_blank" rel="noopener noreferrer"':'') +
        ' aria-label="Visit ' + escape(p.name) + '">' + imagePicture(p) +
        '<span class="more-project-screen-label">Project screenshot <b aria-hidden="true">↗</b></span></a>' +
        '<div class="more-project-content"><span class="project-index">' + escape(p.category.toUpperCase()) +
        '</span><h3>' + escape(p.name) + '</h3><p>' + escape(p.description) +
        '</p><a class="text-link" href="' + escape(url) + '"' +
        (live(p)?' target="_blank" rel="noopener noreferrer"':'') +
        '>View project <b>↗</b></a></div></article>';
    }).join("");
    const moreSection = $(".portfolio-more");
    if (moreSection) moreSection.hidden=extra.length===0;
    const casesSection = $(".portfolio-cases");
    if (casesSection) casesSection.hidden=featured.length===0;
  }
  function applyVisibility(sections) {
    const links = {services:"/services/",portfolio:"/portfolio/",pricing:"/pricing/",process:"/process/",about:"/about/",contact:"/contact/"};
    for (const [key,path] of Object.entries(links)) {
      if (sections[key]===false) {
        all('nav.nav-links a[href="'+path+'"],footer a[href="'+path+'"]').forEach(node=>node.hidden=true);
        const blocks = {
          services:[".studio-offerings"],portfolio:[".studio-work"],process:[".studio-method"],
          pricing:[],about:[],contact:[".studio-cta"]
        }[key];
        blocks.forEach(selector => { const el=$(selector);if(el)el.hidden=true; });
        if (location.pathname === path) {
          const main = $("main");
          if (main) main.innerHTML='<section class="cms-unavailable"><div class="container"><h1>This page is currently unavailable.</h1><p>Please use the navigation to explore other parts of our website.</p><a class="btn btn-primary" href="/">Return home ↗</a></div></section>';
        }
      }
    }
  }
  async function load() {
    try {
      // Static HTML stays on the screen while the free backend starts.
      const response = await fetch("/api/site",{cache:"no-store",credentials:"same-origin"});
      if (!response.ok) return;
      const {site}=await response.json();
      if (!site?.company || !Array.isArray(site.projects) || !Array.isArray(site.services) || !Array.isArray(site.pricing)) return;
      updateCompany(site);
      applyVisibility(site.sections || {});
      updateHome(site);
      updateAbout(site);
      updateServices(site);
      updatePricing(site);
      updatePortfolio(site);
    } catch (error) {
      // No blank-page failure: the last published static markup remains readable.
      console.info("Using the published static content until the website API is available.");
    }
  }
  void load();
})();
