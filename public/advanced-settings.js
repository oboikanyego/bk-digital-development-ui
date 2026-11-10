(() => {
"use strict";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const paths=[
  ["/","Homepage"],["/services/","Services"],["/portfolio/","Portfolio"],
  ["/pricing/","Pricing"],["/process/","Process"],["/about/","About"],["/contact/","Contact"]
];
let site=null,revision=0,dirty=false,activePage="home",saving=false;
const listConfig={
 navigation:{fields:["label","href"],title:"Menu link",max:10},
 footerLinks:{fields:["label","href"],title:"Footer link",max:10},
 testimonials:{fields:["name","role","quote"],title:"Testimonial",max:12},
 faqs:{fields:["question","answer"],title:"FAQ",max:25},
 homepageSections:{fields:["heading","description","ctaText","href"],title:"Homepage section",max:10}
};
const info=(text,bad=false)=>{$("settingsStatus").textContent=text;$("settingsStatus").classList.toggle("error",bad);};
async function api(path,options={}){
 if(window.MDVService)await window.MDVService.ensureReady();
 const r=await fetch("/api/admin"+path,{credentials:"same-origin",cache:"no-store",...options,
  headers:{"content-type":"application/json",...(options.headers||{})}});
 if(r.status===401){location.replace("/admin/login/");throw Error("Admin session expired.");}
 const json=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(json.message||"Request could not be completed.");
 return json;
}
const setDirty=()=>{
 dirty=true;$("settingsPublish").disabled=saving;
 $("settingsRevision").textContent="Unpublished changes · revision "+revision;
};
const arrayFor=name=>name==="footerLinks"?site.siteConfig.footer.links:site.siteConfig[name];
const labelFor=field=>({
 label:"Link label",href:"Page",name:"Customer name",role:"Role or company",
 quote:"Testimonial",question:"Question",answer:"Answer",heading:"Heading",
 description:"Description",ctaText:"Button text"
}[field]||field);
const maxFor=field=>({
 label:65,name:100,role:100,quote:550,question:190,answer:1000,
 heading:110,description:400,ctaText:70
}[field]||200);
function editorField(list,index,field,value){
 const common='data-config-list="'+list+'" data-config-index="'+index+'" data-config-field="'+field+'"';
 if(field==="href")return "<label>"+labelFor(field)+"<select "+common+">"+
 paths.map(([v,n])=>'<option value="'+v+'" '+(v===value?"selected":"")+'>'+esc(n)+"</option>").join("")+
 "</select></label>";
 if(["quote","answer","description"].includes(field))
  return "<label class='span-all'>"+labelFor(field)+"<textarea "+common+" maxlength='"+maxFor(field)+"' rows='3'>"+
  esc(value)+"</textarea></label>";
 return "<label>"+labelFor(field)+"<input "+common+" maxlength='"+maxFor(field)+"' value='"+
   esc(value)+"' required></label>";
}
function renderList(name){
 const def=listConfig[name],items=arrayFor(name),root=$(name+"Editor");
 if(!root)return;
 root.innerHTML=items.length?items.map((item,index)=>
  "<article class='settings-item'><div class='settings-item-actions'><h3>"+def.title+" "+(index+1)+
  "</h3><button type='button' class='button secondary' data-remove-config='"+name+"' data-remove-index='"+
  index+"'>Remove</button></div><div class='business-form-grid'>"+
  def.fields.map(field=>editorField(name,index,field,item[field]??"")).join("")+
  "</div><label class='settings-check'><input type='checkbox' data-config-list='"+name+
  "' data-config-index='"+index+"' data-config-field='visible' "+(item.visible!==false?"checked":"")+
  "> Visible on website</label></article>"
 ).join(""):"<p>No "+def.title.toLowerCase()+" entries. Add one when ready.</p>";
}
function render(){
 const cfg=site.siteConfig||{},current=cfg.seo?.[activePage]||{};
 $("seoPage").value=activePage;
 $("seoTitle").value=current.title||"";
 $("seoDescription").value=current.description||"";
 $("seoRobots").value=current.robots||"index,follow";
 $("seoImage").value=current.imageUrl||"";
 $("footerDescription").value=cfg.footer?.description||"";
 $("footerHeading").value=cfg.footer?.contactHeading||"";
 $("footerEmail").checked=cfg.footer?.showEmail!==false;
 $("designAccent").value=(cfg.design?.accentColor||"#087d9f").toLowerCase();
 $("designBackground").value=(cfg.design?.backgroundColor||"#ffffff").toLowerCase();
 $("designText").value=(cfg.design?.textColor||"#132f46").toLowerCase();
 $("designRadius").value=cfg.design?.buttonRadius??8;
 Object.keys(listConfig).forEach(renderList);
 $("settingsRevision").textContent="Published revision "+revision;
 $("settingsPublish").disabled=!dirty||saving;
}
function add(name){
 const a=arrayFor(name),def=listConfig[name];if(a.length>=def.max)return info("Maximum "+def.max+" entries.",true);
 const next={id:name.slice(0,4)+"-"+Date.now().toString(36),visible:true};
 for(const field of def.fields)next[field]=field==="href"?"/contact/":"";
 a.push(next);renderList(name);setDirty();
}
$("seoPage").addEventListener("change",e=>{activePage=e.target.value;render();});
for(const [id,key] of [["seoTitle","title"],["seoDescription","description"],["seoRobots","robots"],["seoImage","imageUrl"]]){
 $(id).addEventListener("input",e=>{if(!site)return;site.siteConfig.seo[activePage][key]=e.target.value;setDirty();});
}
for(const [id,key] of [["footerDescription","description"],["footerHeading","contactHeading"]]){
 $(id).addEventListener("input",e=>{if(!site)return;site.siteConfig.footer[key]=e.target.value;setDirty();});
}
$("footerEmail").addEventListener("change",e=>{site.siteConfig.footer.showEmail=e.target.checked;setDirty();});
for(const [id,key] of [["designAccent","accentColor"],["designBackground","backgroundColor"],["designText","textColor"],["designRadius","buttonRadius"]]){
 $(id).addEventListener("input",e=>{
  site.siteConfig.design[key]=key==="buttonRadius"?Number(e.target.value):e.target.value;
  setDirty();
 });
}
function updateList(event){
 const target=event.target,list=target.dataset.configList;
 if(!list||!site)return;
 const item=arrayFor(list)[Number(target.dataset.configIndex)];
 if(!item)return;
 const field=target.dataset.configField;
 item[field]=field==="visible"?target.checked:target.value;
 setDirty();
}
document.addEventListener("input",updateList);
document.addEventListener("change",updateList);
document.addEventListener("click",e=>{
 const add=e.target.closest("[data-add-config]");
 if(add&&site){addItem(add.dataset.addConfig);return;}
 const remove=e.target.closest("[data-remove-config]");
 if(remove&&site){
  const list=remove.dataset.removeConfig,index=Number(remove.dataset.removeIndex);
  if(!confirm("Remove this entry on the next publish?"))return;
  arrayFor(list).splice(index,1);renderList(list);setDirty();
 }
});
function addItem(list){add(list);}
$("settingsPublish").addEventListener("click",async()=>{
 if(!site||!dirty||saving)return;
 saving=true;$("settingsPublish").disabled=true;info("Validating and publishing website settings…");
 try{
  const response=await api("/site",{method:"PUT",body:JSON.stringify({site,revision})});
  site=response.site;revision=site.revision;dirty=false;render();
  info("Website settings published to MongoDB. Refresh a public page to see the changes.");
 }catch(e){info(e.message,true);}
 finally{saving=false;$("settingsPublish").disabled=!dirty;}
});
$("settingsLogout").addEventListener("click",async()=>{
 try{await fetch("/api/admin/auth/logout",{method:"POST",credentials:"same-origin"});}
 finally{location.replace("/admin/login/");}
});
window.addEventListener("beforeunload",e=>{
 if(dirty){e.preventDefault();e.returnValue="";}
});
api("/site").then(result=>{
 site=result.site;revision=site.revision;
 if(!site.siteConfig)throw Error("Website settings have not been migrated.");
 render();info("Settings loaded from MongoDB.");
}).catch(e=>{info(e.message,true);$("settingsRevision").textContent="Unavailable";});
})();
