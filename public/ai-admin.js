(() => {
"use strict";
const target=document.getElementById("aiConversionKpis");
if(!target)return;
const rates=document.getElementById("aiConversionRates");
const fields=[
 ["opened","AI chats opened","message-circle"],
 ["idea_submitted","Ideas explored","sparkles"],
 ["brief_reviewed","Briefs reviewed","clipboard-check"],
 ["lead_submitted","Leads submitted","users"],
 ["quotation_drafted","Quotes drafted","file-text"],
 ["quotation_sent","Quotes sent","send"],
 ["converted","Converted leads","check-circle"]
];
async function load(){
 try{
  if(window.MDVService)await window.MDVService.ensureReady();
  const response=await fetch("/api/admin/ai/analytics?days=30",{
    cache:"no-store",credentials:"same-origin"
  });
  if(response.status===401){location.replace("/admin/login/");return;}
  if(!response.ok)throw Error("AI conversion reporting is unavailable.");
  const data=await response.json();
  const totals=data.totals||{};
  target.replaceChildren();
  for(const [key,label] of fields){
    const item=document.createElement("article");
    const name=document.createElement("span");name.textContent=label;
    const count=document.createElement("strong");
    count.textContent=Number(totals[key]||0).toLocaleString("en-ZA");
    item.append(name,count);target.append(item);
  }
  const stats=data.rates||{};
  rates.replaceChildren();
  for(const [label,value] of [
    ["Idea engagement",stats.ideasPerOpen],
    ["Idea to lead",stats.leadsPerIdea],
    ["Brief to lead",stats.leadsPerReview],
    ["Lead to quotation draft",stats.quotesPerLead]
  ]){
    const item=document.createElement("span");
    const title=document.createElement("strong");title.textContent=label;
    const percent=document.createElement("b");
    percent.textContent=Number(value||0).toFixed(1)+"%";
    item.append(title,percent);rates.append(item);
  }
 }catch(error){target.textContent=error.message;}
}
document.addEventListener("mdv:admin-ready",()=>load());
document.getElementById("refresh")?.addEventListener("click",()=>load());
})();