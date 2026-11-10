/* Visual site editor — protected by the existing eight-hour admin session. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const textInput = (label, group, index, field, value, max=180) =>
    '<label>'+esc(label)+'<input data-group="'+group+'" data-index="'+index+'" data-field="'+field+
    '" maxlength="'+max+'" value="'+esc(value)+'"></label>';
  const textArea = (label, group, index, field, value, max=700, rows=3) =>
    '<label class="wide">'+esc(label)+'<textarea data-group="'+group+'" data-index="'+index+
    '" data-field="'+field+'" maxlength="'+max+'" rows="'+rows+'">'+esc(value)+'</textarea></label>';
  const toggle = (label,group,index,field,value) =>
    '<label class="cms-toggle"><input type="checkbox" data-group="'+group+'" data-index="'+index+
    '" data-field="'+field+'" '+(value?'checked':'')+'><span>'+esc(label)+'</span></label>';
  let site=null,revision=null,dirty=false,publishing=false;

  function status(message, error=false) {
    const node=byId("cmsStatus");
    node.textContent=message;
    node.className=error?"message error":"message";
  }
  function markDirty(){
    dirty=true;byId("editState").textContent="Unpublished changes";
    byId("editState").className="edit-state dirty";
    byId("publishSite").disabled=false;
  }
  function markSaved(){
    dirty=false;byId("editState").textContent="All changes published";
    byId("editState").className="edit-state";
    byId("publishSite").disabled=false;
  }
  async function api(path,options={}){
    if(window.MDVService)await window.MDVService.ensureReady();
    const response=await fetch("/api/admin"+path,{
      ...options,credentials:"same-origin",cache:"no-store",
      headers:{"content-type":"application/json",...options.headers}
    });
    const body=await response.json().catch(()=>({}));
    if(response.status===401){
      location.replace("/admin/login/");
      throw Error("Session expired. Sign in again.");
    }
    if(!response.ok)throw Error(body.message||"Unable to complete your request.");
    return body;
  }
  function preview(url,description){
    if(!url)return '<div class="cms-no-photo">'+esc(description||"No image selected")+'</div>';
    return '<img src="'+esc(url)+'" alt="'+esc(description||"Image preview")+'" loading="lazy" decoding="async">';
  }
  function renderFields(){
    all("[data-path]").forEach(input=>{
      const [group,field]=input.dataset.path.split(".");
      input.value=site[group]?.[field]??"";
    });
    byId("logoPreview").innerHTML=preview(site.company.logoUrl,"Company logo");
  }
  function renderServices(){
    byId("serviceEditor").innerHTML=site.services.map((item,i)=>
      '<article class="cms-item"><div class="cms-item-head"><strong>'+esc(item.title||"New service")+
      '</strong><div class="cms-item-actions">'+toggle("Visible","services",i,"visible",item.visible)+
      '<button type="button" class="button secondary" data-move="services" data-index="'+i+'" data-direction="-1" '+(i===0?"disabled":"")+'>↑</button>'+
      '<button type="button" class="button secondary" data-move="services" data-index="'+i+'" data-direction="1" '+(i===site.services.length-1?"disabled":"")+'>↓</button>'+
      '<button type="button" class="button secondary danger" data-remove="services" data-index="'+i+'">Remove</button></div></div>'+
      '<div class="cms-form-grid">'+textInput("Title","services",i,"title",item.title,100)+
      textInput("Category","services",i,"category",item.category,40)+
      textArea("Description","services",i,"description",item.description,500)+'</div></article>'
    ).join("")||'<p>No services yet. Add one using the button above.</p>';
  }
  function renderProjects(){
    byId("projectEditor").innerHTML=site.projects.map((item,i)=>
      '<article class="cms-item"><div class="cms-item-head"><strong>'+esc(item.name||"New project")+
      '</strong><div class="cms-item-actions">'+toggle("Published","projects",i,"visible",item.visible)+
      '<button type="button" class="button secondary" data-move="projects" data-index="'+i+'" data-direction="-1" '+(i===0?"disabled":"")+'>↑</button>'+
      '<button type="button" class="button secondary" data-move="projects" data-index="'+i+'" data-direction="1" '+(i===site.projects.length-1?"disabled":"")+'>↓</button>'+
      '<button type="button" class="button secondary danger" data-remove="projects" data-index="'+i+'">Remove</button></div></div>'+
      '<div class="cms-form-grid">'+textInput("Project name","projects",i,"name",item.name,90)+
      textInput("Category","projects",i,"category",item.category,60)+
      textArea("Short description","projects",i,"description",item.description,650)+
      textInput("Live URL (HTTPS)","projects",i,"liveUrl",item.liveUrl,400)+
      textInput("Case study URL (HTTPS)","projects",i,"caseStudyUrl",item.caseStudyUrl,400)+
      textArea("Challenge / problem","projects",i,"problem",item.problem,400,2)+
      textArea("How you solved it","projects",i,"approach",item.approach,400,2)+
      textInput("Technologies (comma-separated)","projects",i,"stackText",(item.stack||[]).join(", "),320)+'</div>'+
      '<div class="cms-item-options">'+toggle("Featured case study","projects",i,"featured",item.featured)+
      toggle("Show on homepage","projects",i,"homeFeatured",item.homeFeatured)+'</div>'+
      '<div class="cms-project-photos"><div><strong>Desktop project image</strong><div class="cms-image-preview">'+preview(item.imageUrl,item.name+" screenshot")+
      '</div><label class="button secondary cms-upload-label">Upload desktop image<input type="file" data-upload="project-image" data-index="'+i+'" accept="image/jpeg,image/png,image/webp" hidden></label></div>'+
      '<div><strong>Mobile project image</strong><div class="cms-image-preview mobile">'+preview(item.mobileImageUrl,"Mobile screenshot")+
      '</div><label class="button secondary cms-upload-label">Upload mobile image<input type="file" data-upload="project-mobile" data-index="'+i+'" accept="image/jpeg,image/png,image/webp" hidden></label></div></div></article>'
    ).join("")||'<p>No projects yet. Add one using the button above.</p>';
  }
  function renderPricing(){
    byId("pricingEditor").innerHTML=site.pricing.map((item,i)=>
      '<article class="cms-item"><div class="cms-item-head"><strong>'+esc(item.name||"New package")+
      '</strong><div class="cms-item-actions">'+toggle("Visible","pricing",i,"visible",item.visible)+
      '<button type="button" class="button secondary" data-move="pricing" data-index="'+i+'" data-direction="-1" '+(i===0?"disabled":"")+'>↑</button>'+
      '<button type="button" class="button secondary" data-move="pricing" data-index="'+i+'" data-direction="1" '+(i===site.pricing.length-1?"disabled":"")+'>↓</button>'+
      '<button type="button" class="button secondary danger" data-remove="pricing" data-index="'+i+'">Remove</button></div></div>'+
      '<div class="cms-form-grid">'+textInput("Package name","pricing",i,"name",item.name,70)+
      textInput("Price display","pricing",i,"price",item.price,65)+
      textInput("Headline","pricing",i,"heading",item.heading,150)+
      '<label>Pricing group<select data-group="pricing" data-index="'+i+'" data-field="group">'+
      '<option value="web" '+(item.group==="web"?"selected":"")+'>Websites & systems</option>'+
      '<option value="app" '+(item.group==="app"?"selected":"")+'>Mobile apps</option></select></label>'+
      textArea("Features (one per line)","pricing",i,"featuresText",(item.features||[]).join("\n"),1300,5)+
      '</div></article>'
    ).join("")||'<p>No packages yet. Add one using the button above.</p>';
  }
  const sectionLabels = {
    services:"Services page", portfolio:"Projects page",pricing:"Pricing page",
    process:"How we work",about:"About us page",contact:"Contact page"
  };
  function renderVisibility(){
    byId("visibilityEditor").innerHTML=Object.entries(sectionLabels).map(([key,label])=>
      '<label class="cms-page-control"><span><strong>'+esc(label)+'</strong><small>/'+esc(key)+'/</small></span>'+
      '<input type="checkbox" data-section-visibility="'+key+'" '+(site.sections[key]!==false?"checked":"")+'></label>'
    ).join("");
  }
  function render(){
    renderFields();renderServices();renderProjects();renderPricing();renderVisibility();
  }
  function addItem(group){
    if(group==="projects"){
      if(site.projects.length>=40)return status("The project limit is 40.",true);
      site.projects.push({
        id:"project-"+Date.now().toString(36),name:"New project",category:"Software",description:"Describe the project and its purpose.",
        problem:"",approach:"",imageUrl:"",mobileImageUrl:"",liveUrl:"",caseStudyUrl:"",
        stack:[],featured:false,homeFeatured:false,visible:false
      });
    } else if(group==="services"){
      if(site.services.length>=18)return status("The service limit is 18.",true);
      site.services.push({id:"service-"+Date.now().toString(36),title:"New service",category:"Services",description:"Describe the service.",visible:false});
    } else if(group==="pricing"){
      if(site.pricing.length>=20)return status("The package limit is 20.",true);
      site.pricing.push({id:"package-"+Date.now().toString(36),name:"New package",heading:"Describe this package.",price:"From R0",group:"web",features:[],visible:false});
    }
    markDirty();renderGroup(group);
  }
  function renderGroup(group){
    if(group==="projects")renderProjects();
    if(group==="services")renderServices();
    if(group==="pricing")renderPricing();
  }
  async function upload(file,callback){
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Use a JPG, PNG or WebP image.");
    if(file.size>8*1024*1024)throw Error("Images must be smaller than 8 MB.");
    status("Preparing a secure Cloudinary upload…");
    const info=await api("/media/sign",{method:"POST",body:"{}"});
    const fd=new FormData();
    fd.append("file",file);
    fd.append("api_key",info.apiKey);
    fd.append("timestamp",String(info.timestamp));
    fd.append("folder",info.folder);
    fd.append("unique_filename","true");
    fd.append("signature",info.signature);
    const response=await fetch("https://api.cloudinary.com/v1_1/"+encodeURIComponent(info.cloudName)+"/image/upload",{
      method:"POST",body:fd
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.secure_url)throw Error(result.error?.message||"Cloudinary rejected the image. Check your Cloudinary setup.");
    const asset=new URL(result.secure_url);
    if(asset.protocol!=="https:"||asset.hostname!=="res.cloudinary.com"||!asset.pathname.startsWith("/"+info.cloudName+"/image/upload/"))
      throw Error("The image upload did not return an approved Cloudinary URL.");
    callback(result.secure_url);
    markDirty();
    status("Image uploaded to Cloudinary. Click Publish changes to update the website.");
  }
  async function publish(){
    if(!site||publishing||!dirty)return;
    const button=byId("publishSite");
    publishing=true;button.disabled=true;button.textContent="Publishing…";
    status("Saving your changes to MongoDB…");
    try{
      const response=await api("/site",{method:"PUT",body:JSON.stringify({site,revision})});
      site=response.site;revision=site.revision;
      render();markSaved();status("Website published. Reload the public site to view your changes.");
    }catch(error){
      status(error.message,true);
      byId("editState").textContent="Changes not published";
    }finally{publishing=false;button.disabled=false;button.textContent="Publish changes ↗";}
  }
  async function initialize(){
    try{
      const response=await api("/site");
      if(!response.site)throw Error("The website content is not available.");
      site=response.site;revision=site.revision;
      byId("cmsWorkspace").hidden=false;
      render();markSaved();status("Content loaded from MongoDB. Make changes and publish when ready.");
    }catch(error){status(error.message||"Unable to load the website editor.",true);byId("editState").textContent="Connection unavailable";}
  }

  all(".cms-tab").forEach(button=>button.addEventListener("click",()=>{
    const selected=button.dataset.tab;
    all(".cms-tab").forEach(b=>{
      const active=b===button;
      b.classList.toggle("active",active);
      if(active)b.setAttribute("aria-current","page");
      else b.removeAttribute("aria-current");
    });
    all(".cms-panel").forEach(panel=>{panel.hidden=panel.dataset.panel!==selected;});
  }));
  document.addEventListener("input",event=>{
    const input=event.target;
    if(!site)return;
    if(input.dataset.path){
      const [group,field]=input.dataset.path.split(".");
      site[group][field]=input.value;markDirty();return;
    }
    if(input.dataset.group&&input.dataset.field&&!input.matches("[type=checkbox],select")){
      const row=site[input.dataset.group][Number(input.dataset.index)];
      const key=input.dataset.field;
      if(!row)return;
      if(key==="stackText")row.stack=input.value.split(",").map(s=>s.trim()).filter(Boolean).slice(0,14);
      else if(key==="featuresText")row.features=input.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,12);
      else row[key]=input.value;
      markDirty();
    }
  });
  document.addEventListener("change",event=>{
    const input=event.target;
    if(!site)return;
    if(input.dataset.upload){
      const index=Number(input.dataset.index);
      const dest=input.dataset.upload;
      void upload(input.files[0],url=>{
        if(dest==="project-image")site.projects[index].imageUrl=url;
        else if(dest==="project-mobile")site.projects[index].mobileImageUrl=url;
        renderProjects();
      }).catch(error=>status(error.message,true));
      return;
    }
    if(input.id==="logoUpload"){
      void upload(input.files[0],url=>{site.company.logoUrl=url;renderFields();}).catch(error=>status(error.message,true));
      return;
    }
    if(input.dataset.sectionVisibility){
      site.sections[input.dataset.sectionVisibility]=input.checked;markDirty();return;
    }
    if(input.dataset.group&&input.dataset.field){
      const row=site[input.dataset.group][Number(input.dataset.index)];
      if(!row)return;
      row[input.dataset.field]=input.type==="checkbox"?input.checked:input.value;
      markDirty();
    }
  });
  document.addEventListener("click",event=>{
    const move=event.target.closest("[data-move]");
    if(move&&site){
      const group=move.dataset.move,i=Number(move.dataset.index),target=i+Number(move.dataset.direction);
      if(target<0||target>=site[group].length)return;
      [site[group][i],site[group][target]]=[site[group][target],site[group][i]];
      renderGroup(group);markDirty();return;
    }
    const remove=event.target.closest("[data-remove]");
    if(remove&&site){
      const group=remove.dataset.remove,index=Number(remove.dataset.index);
      if(!window.confirm("Remove this "+group.slice(0,-1)+" from the website? This takes effect when you publish."))return;
      site[group].splice(index,1);renderGroup(group);markDirty();return;
    }
    const add=event.target.closest("[data-add]");
    if(add&&site)addItem(add.dataset.add);
  });
  byId("publishSite").addEventListener("click",()=>void publish());
  byId("editorLogout").addEventListener("click",async()=>{
    try{await fetch("/api/admin/auth/logout",{method:"POST",credentials:"same-origin"});}
    finally{location.replace("/admin/login/");}
  });
  window.addEventListener("beforeunload",event=>{
    if(dirty){event.preventDefault();event.returnValue="";}
  });
  void initialize();
})();
