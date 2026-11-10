(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const fields = ["name","description","subject","html","text","logoUrl","enabled"];
  const ids = {name:"templateName",description:"templateDescription",subject:"templateSubject",
    html:"templateHtml",text:"templateText",logoUrl:"templateLogo",enabled:"templateEnabled"};
  let draft = null, revision = 0, key = "", dirty = false, busy = false;
  let activeTextField = $("templateHtml");
  const status = (message, error = false) => {
    $("editorStatus").textContent = message;
    $("editorStatus").className = error ? "message error" : "message";
  };
  const escape = text => String(text??"").replace(/[&<>"']/g,c=>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function api(path, options = {}) {
    if (window.MDVService) await window.MDVService.ensureReady();
    const res = await fetch("/api/admin" + path, {
      credentials:"same-origin", cache:"no-store", ...options,
      headers:{"content-type":"application/json",...(options.headers||{})}
    });
    const body = await res.json().catch(()=>({}));
    if (res.status === 401) {
      location.replace("/admin/login/");
      throw Error("Session expired. Sign in again.");
    }
    if (!res.ok) throw Error(body.message || "Request failed (HTTP " + res.status + ").");
    return body;
  }
  function state() {
    $("saveState").textContent = dirty ? "Unpublished changes" : "Published";
    $("saveState").classList.toggle("dirty",dirty);
    $("publishButton").disabled = !dirty || busy;
    $("previewButton").disabled = !draft || busy;
  }
  function showTemplate() {
    for(const field of fields) {
      const control = $(ids[field]);
      if(field==="enabled") control.checked = draft[field] !== false;
      else control.value = draft[field] ?? "";
    }
    $("emailLogo").src = draft.logoUrl;
    state();
  }
  function readDraft() {
    if (!draft) return;
    for (const field of fields) {
      const control = $(ids[field]);
      draft[field] = field==="enabled" ? control.checked : control.value;
    }
  }
  function templateKey() { return encodeURIComponent(key); }
  function selectPanel(kind) {
    $("htmlPanel").hidden=kind!=="html";
    $("textPanel").hidden=kind!=="text";
    $("htmlTab").classList.toggle("active",kind==="html");
    $("textTab").classList.toggle("active",kind==="text");
    $("htmlTab").setAttribute("aria-selected",String(kind==="html"));
    $("textTab").setAttribute("aria-selected",String(kind==="text"));
    activeTextField = $(kind==="html"?"templateHtml":"templateText");
  }
  function addVariable(token) {
    if (!draft) return;
    const field = activeTextField && ["templateHtml","templateText","templateSubject"].includes(activeTextField.id)
      ? activeTextField : $("templateHtml");
    const start=field.selectionStart??field.value.length, end=field.selectionEnd??start;
    field.setRangeText("{{"+token+"}}",start,end,"end");
    field.focus();
    readDraft(); dirty=true;state();
  }
  async function loadTemplate(nextKey) {
    if (dirty && !confirm("Discard your unpublished template edits?")) {
      $("templateSelect").value=key;
      return;
    }
    busy=true;state();status("Loading email template from MongoDB…");
    try {
      const result=await api("/email/templates/"+encodeURIComponent(nextKey));
      key=nextKey;revision=result.template.revision;draft=result.template;
      $("templateSelect").value=key;
      dirty=false;showTemplate();$("editorWorkspace").hidden=false;
      $("previewSubject").textContent="Choose Preview email to render sample data";
      $("emailPreviewFrame").srcdoc="";
      $("previewText").textContent="";
      status("Template revision "+revision+" loaded from MongoDB.");
    }catch(error){status(error.message,true);}
    finally{busy=false;state();}
  }
  async function preview() {
    if (!draft || busy) return;
    busy=true;readDraft();state();status("Rendering preview with sample enquiry details…");
    try{
      const result=await api("/email/templates/"+templateKey()+"/preview",{
        method:"POST",body:JSON.stringify({template:draft})
      });
      $("previewSubject").textContent=result.subject;
      $("previewText").textContent=result.text;
      // The sandbox prevents script execution, forms and page navigation in admin.
      $("emailPreviewFrame").srcdoc=result.html;
      status("Preview rendered. Nothing has been sent or published.");
    }catch(error){status(error.message,true);}
    finally{busy=false;state();}
  }
  async function publish() {
    if(!draft||!dirty||busy)return;
    busy=true;readDraft();state();$("publishButton").textContent="Publishing…";
    try {
      const result=await api("/email/templates/"+templateKey(),{
        method:"PUT",body:JSON.stringify({revision,template:draft})
      });
      draft=result.template;revision=draft.revision;dirty=false;
      showTemplate();status("Template published to MongoDB (revision "+revision+"). New enquiries use this version.");
    }catch(error){status(error.message+" Your changes are still in the editor.",true);}
    finally{busy=false;state();$("publishButton").textContent="Publish to MongoDB";}
  }
  async function uploadLogo(file) {
    if(!file)return;
    if(!["image/png","image/jpeg"].includes(file.type)||file.size>8*1024*1024)
      return status("Choose a PNG or JPG smaller than 8 MB.",true);
    busy=true;state();status("Uploading logo to Cloudinary…");
    try {
      const info=await api("/media/sign",{method:"POST",body:"{}"});
      const data=new FormData();
      data.append("file",file);
      data.append("api_key",info.apiKey);
      data.append("timestamp",String(info.timestamp));
      data.append("signature",info.signature);
      data.append("folder",info.folder);
      data.append("unique_filename","true");
      const response=await fetch("https://api.cloudinary.com/v1_1/"+encodeURIComponent(info.cloudName)+"/image/upload",{
        method:"POST",body:data
      });
      const asset=await response.json().catch(()=>({}));
      if(!response.ok||!asset.secure_url)throw Error(asset.error?.message||"Logo upload failed.");
      const url=new URL(asset.secure_url);
      if(url.protocol!=="https:"||url.hostname!=="res.cloudinary.com"||!/\.(png|jpe?g)$/i.test(url.pathname))
        throw Error("Cloudinary returned an unsupported email logo.");
      draft.logoUrl=asset.secure_url;$("templateLogo").value=asset.secure_url;
      $("emailLogo").src=asset.secure_url;dirty=true;
      status("Logo uploaded. Publish the template to use it in new emails.");
    }catch(error){status(error.message,true);}
    finally{busy=false;state();}
  }
  async function initialize() {
    try{
      const [templates,variables]=await Promise.all([
        api("/email/templates"),api("/email/template-variables")
      ]);
      const list=templates.items||[];
      if(!list.length)throw Error("No email templates exist in MongoDB.");
      for(const item of list) {
        const opt=document.createElement("option");
        opt.value=item._id||item.key;opt.textContent=item.name;
        $("templateSelect").appendChild(opt);
      }
      (variables.variables||[]).forEach(v=>{
        const button=document.createElement("button");
        button.type="button";button.className="variable-token";button.textContent="{{"+v+"}}";
        button.title="Insert "+v;button.addEventListener("click",()=>addVariable(v));
        $("variablesList").appendChild(button);
      });
      await loadTemplate(list[0]._id||list[0].key);
      if(draft)await preview();
    }catch(error){status(error.message,true);$("saveState").textContent="Unavailable";}
  }
  $("templateSelect").addEventListener("change",event=>void loadTemplate(event.target.value));
  for (const field of fields) {
    const control=$(ids[field]);
    control.addEventListener(field==="enabled"?"change":"input",()=>{
      if(!draft)return;
      readDraft();dirty=true;state();
      if(field==="logoUrl")$("emailLogo").src=draft.logoUrl;
    });
    if(["subject","html","text"].includes(field))
      control.addEventListener("focus",()=>{activeTextField=control;});
  }
  $("htmlTab").addEventListener("click",()=>selectPanel("html"));
  $("textTab").addEventListener("click",()=>selectPanel("text"));
  $("previewButton").addEventListener("click",()=>void preview());
  $("publishButton").addEventListener("click",()=>void publish());
  $("templateLogoUpload").addEventListener("change",event=>void uploadLogo(event.target.files[0]));
  $("logout").addEventListener("click",async()=>{
    if(dirty&&!confirm("Discard unpublished email template edits and sign out?"))return;
    try{await fetch("/api/admin/auth/logout",{method:"POST",credentials:"same-origin"});}
    finally{dirty=false;location.replace("/admin/login/");}
  });
  window.addEventListener("beforeunload",event=>{
    if(dirty){event.preventDefault();event.returnValue="";}
  });
  void initialize();
})();
