(() => {
"use strict";
const screen=document.body.dataset.businessScreen;
const $=id=>document.getElementById(id);
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=cents=>"R "+(Number(cents||0)/100).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2});
const date=s=>s?new Date(s).toLocaleString("en-ZA",{dateStyle:"medium",timeZone:"Africa/Johannesburg"}):"Not set";
const notify=(message,bad=false)=>{const node=$("bizFeedback");node.textContent=message;node.classList.toggle("error",bad);};
async function api(path,options={}){
 if(window.MDVService)await window.MDVService.ensureReady();
 const response=await fetch("/api/admin"+path,{credentials:"same-origin",cache:"no-store",...options,
  headers:{"content-type":"application/json",...(options.headers||{})}});
 if(response.status===401){location.assign("/admin/login/");throw Error("Admin session expired. Sign in again.");}
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.message||"Request failed (HTTP "+response.status+").");
 return value;
}
$("bizLogout").addEventListener("click",async()=>{
 try{await fetch("/api/admin/auth/logout",{method:"POST",credentials:"same-origin"});}
 finally{location.assign("/admin/login/");}
});

if(screen==="crm"){
 let page=1,total=0,selected="";
 const stageOptions=["lead","qualified","proposal","active","on_hold","completed","closed"];
 async function load(){
  const q=$("crmSearch").value.trim(),status=$("crmStage").value;
  const request=new URLSearchParams({q,status,page:String(page)});
  const [res,due,summary]=await Promise.all([
    api("/crm/clients?"+request),api("/crm/follow-ups"),api("/crm/metrics")
  ]);
  total=res.total;
  $("crmClientTotal").textContent=summary.clients??res.total;
  $("crmDueTotal").textContent=summary.dueFollowUps??0;
  $("crmPageLabel").textContent=res.total+" clients · Page "+page;
  $("crmPrev").disabled=page<=1;$("crmNext").disabled=page*25>=res.total;
  $("crmRows").innerHTML=res.items.length?res.items.map(c=>
    "<tr><td><strong>"+escape(c.name||c.email)+"</strong><small>"+escape(c.email)+"</small></td><td>"+
    escape(c.businessName||"—")+"</td><td><span class='business-status'>"+
    escape(c.projectStatus||"lead").replace("_"," ")+"</span></td><td>"+
    escape(c.followUpDate||"Not scheduled")+"</td><td><button class='button secondary' type='button' data-client='"+
    escape(c._id)+"'>Open profile</button></td></tr>"
  ).join(""):"<tr><td colspan='5'>No matching clients yet.</td></tr>";
  $("crmDueList").innerHTML=due.items.length?due.items.map(c=>
    "<div class='business-due'><strong>"+escape(c.name||c.email)+"</strong><span>Follow-up: "+
    escape(c.followUpDate)+"</span><span>"+escape(c.projectStatus||"lead")+"</span>"+
    "<button class='button secondary' type='button' data-client='"+escape(c._id)+"'>Open profile</button></div>"
  ).join(""):"<p>No overdue follow-ups.</p>";
  notify("CRM refreshed.");
 }
 async function openClient(email){
  selected=email;
  const res=await api("/crm/clients/"+encodeURIComponent(email));
  const c=res.profile,form=$("clientForm");
  $("clientHeading").textContent=c.name||c.email;
  $("clientEmailLabel").textContent=c.email;
  for(const name of ["name","phone","businessName","projectStatus","priority","notes","followUpDate"]){
    form.elements[name].value=c[name]|| (name==="projectStatus"?"lead":name==="priority"?"normal":"");
  }
  $("clientDocumentLink").href="/admin/documents/?client="+encodeURIComponent(email);
  $("clientEnquiries").innerHTML=res.enquiries.length?res.enquiries.map(v=>
    "<div><strong>"+escape(v.projectType||"Project enquiry")+"</strong> · "+
    escape(v.status||"new")+"<small>"+escape(date(v.createdAt))+" · "+
    escape(v.message||"").slice(0,400)+"</small></div>"
  ).join(""):"<p>No enquiries available.</p>";
  $("clientDocuments").innerHTML=res.documents.length?res.documents.map(v=>
    "<div><strong>"+escape(v.number)+"</strong> · "+escape(v.kind)+" · "+
    escape(v.status)+" · "+escape(money(v.totalCents))+"</div>"
  ).join(""):"<p>No quotations or invoices yet.</p>";
  $("clientActivity").innerHTML=res.activity.length?res.activity.map(v=>
    "<div><strong>"+escape(v.action)+"</strong><small>"+escape(date(v.createdAt))+
    "</small></div>"
  ).join(""):"<p>Activity appears as enquiries and changes are recorded.</p>";
  $("clientDialog").showModal();
 }
 $("clientForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(!selected)return;
  const fd=new FormData(event.currentTarget);
  const patch=Object.fromEntries(fd.entries());
  try{
    await api("/crm/clients/"+encodeURIComponent(selected),{method:"PATCH",body:JSON.stringify(patch)});
    $("clientDialog").close();await load();notify("Client profile updated and the activity was recorded.");
  }catch(error){notify(error.message,true);}
 });
 $("clientClose").addEventListener("click",()=>$("clientDialog").close());
 $("crmFilters").addEventListener("submit",event=>{event.preventDefault();page=1;load().catch(e=>notify(e.message,true));});
 $("crmRefresh").addEventListener("click",()=>load().catch(e=>notify(e.message,true)));
 $("crmPrev").addEventListener("click",()=>{page--;load().catch(e=>notify(e.message,true));});
 $("crmNext").addEventListener("click",()=>{page++;load().catch(e=>notify(e.message,true));});
 document.addEventListener("click",event=>{
  const button=event.target.closest("[data-client]");
  if(button)openClient(button.dataset.client).catch(e=>notify(e.message,true));
 });
 load().catch(error=>notify(error.message,true));
}

if(screen==="documents"){
 const label=(k)=>k==="quotation"?"Quotation":"Invoice";
 const params=new URLSearchParams(location.search);
 let clientParam=params.get("client")||"";
 const cents=v=>{
   const normalized=String(v??"").trim();
   if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalized))throw Error("Enter a positive ZAR amount with up to two decimal places.");
   const [whole,decimal=""]=normalized.split(".");
   return Number(whole)*100+Number(decimal.padEnd(2,"0"));
 };
 function newLine(){
  const tr=document.createElement("tr");
  tr.innerHTML="<td><input data-line-description maxlength='180' aria-label='Service description' required placeholder='e.g. Business website build'></td>"+
   "<td><input data-line-quantity type='number' min='1' max='1000' step='1' value='1' aria-label='Quantity' required></td>"+
   "<td><input data-line-price type='number' min='0' max='1000000' step='.01' value='0.00' aria-label='Unit price in rand' required></td>"+
   "<td><button class='button secondary' type='button' data-line-remove>Remove</button></td>";
  $("docItems").appendChild(tr);
 }
 function items(){
  return [...$("docItems").querySelectorAll("tr")].map(tr=>({
    description:tr.querySelector("[data-line-description]").value.trim(),
    quantity:Number(tr.querySelector("[data-line-quantity]").value),
    unitPriceCents:cents(tr.querySelector("[data-line-price]").value)
  }));
 }
 function calc(){
  try{
    const rows=items(),subtotal=rows.reduce((n,row)=>n+row.quantity*row.unitPriceCents,0);
    const tax=Math.round(subtotal*Number($("docTax").value)/10000);
    $("docSubtotal").textContent=money(subtotal);$("docTaxValue").textContent=money(tax);
    $("docTotal").textContent=money(subtotal+tax);
  }catch{$("docTotal").textContent="Check amounts";}
 }
 function kindView(){
  const invoice=$("docKind").value==="invoice";
  $("docDueWrap").hidden=!invoice;$("docValidWrap").hidden=invoice;
 }
 async function loadClients(){
  const res=await api("/crm/clients");
  const client=$("docClient");
  client.innerHTML='<option value="">Select a customer from the CRM</option>'+
  res.items.map(c=>"<option value='"+escape(c._id)+"'>"+escape(c.name||c.email)+" — "+
    escape(c.email)+"</option>").join("");
  if(clientParam){client.value=clientParam;if(client.value!==clientParam){
    const option=document.createElement("option");option.value=clientParam;option.textContent=clientParam;
    client.append(option);client.value=clientParam;
  }}
 }
 async function loadDocuments(){
  const data=await api("/documents");
  $("docRows").innerHTML=data.items.length?data.items.map(doc=>{
    let buttons="<button class='button secondary' type='button' data-doc-action='pdf' data-doc='"+escape(doc._id)+"'>PDF</button>";
    if(doc.status==="draft")buttons+="<button class='button primary' type='button' data-doc-action='send' data-doc='"+escape(doc._id)+"'>Send email</button>"+
       "<button class='button secondary' type='button' data-doc-action='void' data-doc='"+escape(doc._id)+"'>Void</button>";
    if(doc.kind==="quotation"&&doc.status==="sent")buttons+="<button class='button secondary' type='button' data-doc-action='accepted' data-doc='"+escape(doc._id)+"'>Accepted</button>"+
       "<button class='button secondary' type='button' data-doc-action='rejected' data-doc='"+escape(doc._id)+"'>Rejected</button>";
    if(doc.kind==="invoice"&&doc.status==="sent")buttons+="<button class='button secondary' type='button' data-doc-action='paid' data-doc='"+escape(doc._id)+"'>Record payment</button>";
    return "<tr><td><strong>"+escape(doc.number)+"</strong><small>"+escape(label(doc.kind))+
      "</small></td><td>"+escape(doc.clientName||doc.clientId)+"<small>"+escape(doc.clientId)+
      "</small></td><td>"+escape(money(doc.totalCents))+"</td><td><span class='business-status "+
      escape(doc.status)+"'>"+escape(doc.status)+"</span></td><td>"+
      escape(doc.emailDeliveryStatus||"—")+"</td><td>"+buttons+"</td></tr>";
  }).join(""):"<tr><td colspan='6'>No quotations or invoices created yet.</td></tr>";
 }
 async function download(id){
  if(window.MDVService)await window.MDVService.ensureReady();
  const response=await fetch("/api/admin/documents/"+encodeURIComponent(id)+"/pdf",{credentials:"same-origin",cache:"no-store"});
  if(response.status===401){location.assign("/admin/login/");throw Error("Session expired.");}
  if(!response.ok)throw Error("PDF could not be downloaded.");
  const blob=await response.blob();
  if(!blob.type.includes("pdf")||blob.size<200)throw Error("PDF response was invalid.");
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="MDV-document.pdf";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
 }
 async function docAction(id,action){
  if(action==="pdf")return download(id);
  if(action==="send"){
    if(!confirm("Send this PDF document to the client email address?"))return;
    await api("/documents/"+encodeURIComponent(id)+"/send",{method:"POST",body:"{}"});
    notify("PDF email submitted. Check its delivery status separately.");
  }else{
    if(!confirm("Confirm "+action+" for this business document?"))return;
    const paymentReference=action==="paid"?(prompt("Payment reference (optional) — verify payment against your bank statement:")||""):"";
    await api("/documents/"+encodeURIComponent(id)+"/status",{
      method:"PATCH",body:JSON.stringify({status:action,paymentReference})
    });
    notify(action==="paid"?"Payment marked as manually verified.":"Document marked "+action+".");
  }
  await loadDocuments();
 }
 $("documentForm").addEventListener("submit",async event=>{
  event.preventDefault();const button=$("docCreate");
  try{
    button.disabled=true;
    const payload={
      kind:$("docKind").value,clientId:$("docClient").value,items:items(),
      taxRateBp:Number($("docTax").value),notes:$("docNotes").value,
      dueDate:$("docDue").value,validUntil:$("docValid").value
    };
    if(!payload.clientId)throw Error("Select a CRM customer.");
    if(payload.items.some(x=>!x.description||!Number.isSafeInteger(x.quantity)))throw Error("Each line needs a description and whole-number quantity.");
    const output=await api("/documents",{method:"POST",body:JSON.stringify(payload)});
    notify(output.document.number+" created as a draft. Review the PDF before sending.");
    await loadDocuments();$("docNotes").value="";$("docItems").replaceChildren();newLine();calc();
  }catch(error){notify(error.message,true);}finally{button.disabled=false;}
 });
 document.addEventListener("click",event=>{
  const remove=event.target.closest("[data-line-remove]");
  if(remove){remove.closest("tr").remove();if(!$("docItems").children.length)newLine();calc();return;}
  const docButton=event.target.closest("[data-doc-action]");
  if(docButton){docButton.disabled=true;
    docAction(docButton.dataset.doc,docButton.dataset.docAction).catch(error=>notify(error.message,true))
      .finally(()=>{docButton.disabled=false;});}
 });
 $("docItems").addEventListener("input",calc);
 $("docAddItem").addEventListener("click",()=>{if($("docItems").children.length>=25)return notify("Maximum 25 line items.",true);newLine();calc();});
 $("docTax").addEventListener("change",calc);
 $("docKind").addEventListener("change",kindView);
 $("docRefresh").addEventListener("click",()=>loadDocuments().catch(e=>notify(e.message,true)));
 newLine();kindView();calc();
 Promise.all([loadClients(),loadDocuments()]).then(()=>notify("Documents and clients loaded."))
  .catch(error=>notify(error.message,true));
}
})();
