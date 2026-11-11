/* AI-assisted project brief: private in the browser until explicit consented submission. */
(() => {
"use strict";
if(window.MDVAiLeadFlow)return;
const clean=(text,max=500)=>String(text??"").trim().slice(0,max);
const budgets=["Not sure yet","Under R5,000","R5,000 – R15,000","R15,000 – R50,000","R50,000+"];
const timelines=["Flexible","As soon as possible","1–2 months","3–6 months"];
const eventNames=["opened","idea_submitted","brief_reviewed"];
function track(event) {
  if(!eventNames.includes(event))return;
  fetch("/api/ai/events",{method:"POST",credentials:"same-origin",
    headers:{"content-type":"application/json"},body:JSON.stringify({event}),
    keepalive:true}).catch(()=>{});
}
function open({solution={},projectAnswers=[],history=[]}={}) {
  const answers=projectAnswers.filter(x=>typeof x==="string").slice(0,8);
  if(!answers.length)return;
  const chat=history.filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string")
    .slice(-12).map(x=>({role:x.role,content:clean(x.content,900)}));
  const aiSummary=clean([...chat].reverse().find(x=>x.role==="assistant")?.content||"",1000);
  const features=[...new Set((solution.features||[]).filter(x=>typeof x==="string")
    .map(x=>clean(x,160)).filter(x=>x.length>=3))].slice(0,12);
  const selected=features.length?features:["Responsive business website","Contact and enquiry form"];
  const submissionId=crypto.randomUUID();
  let step=0,submitting=false;
  const root=document.createElement("dialog");
  root.className="mdv-brief-dialog";
  root.setAttribute("aria-labelledby","mdvBriefTitle");
  root.innerHTML=`
    <div class="mdv-brief-shell">
      <header class="mdv-brief-head">
        <span class="mdv-brief-mark" aria-hidden="true">✦</span>
        <div class="mdv-brief-head-copy">
          <span class="mdv-brief-eyebrow">MZANSI DIGITAL VENTURES · AI DISCOVERY</span>
          <h2 id="mdvBriefTitle">Turn your idea into a real project.</h2>
          <p>Review your AI-assisted brief before sharing it with our team.</p>
        </div>
        <button type="button" class="mdv-brief-close" aria-label="Close project brief">×</button>
      </header>
      <nav class="mdv-brief-progress" aria-label="Submission progress">
        <span data-pill="0">01 <b>Project brief</b></span>
        <span data-pill="1">02 <b>Your details</b></span>
        <span data-pill="2">03 <b>Confirm</b></span>
      </nav>
      <div class="mdv-brief-content">
        <div class="mdv-brief-main" role="region" aria-label="Project brief review steps" tabindex="0">
          <section data-stage="0" class="mdv-brief-step">
            <div class="mdv-brief-step-heading"><span>STEP 1 OF 3</span><h3>Review your project brief</h3>
              <p>Edit anything the AI misunderstood. We'll use the requirements you approve.</p></div>
            <label class="mdv-brief-field">Project name
              <input name="title" maxlength="140" placeholder="Mascot Sales & Rental Platform"></label>
            <label class="mdv-brief-field">What would you like to build?
              <textarea name="description" maxlength="2600" rows="4"></textarea></label>
            <label class="mdv-brief-field">AI consultant’s recommendation (editable)
              <textarea name="summary" maxlength="1000" rows="3" placeholder="Summary of the AI advice from your conversation"></textarea></label>
            <div class="mdv-brief-field"><div class="mdv-brief-field-head">
              <strong>Recommended features</strong><span data-feature-count></span></div>
              <div class="mdv-brief-features" role="group" aria-label="Project features"></div>
              <div class="mdv-brief-add"><input name="newFeature" maxlength="160" placeholder="Add another feature">
                <button type="button" data-add-feature>Add feature</button></div>
            </div>
            <div class="mdv-brief-columns">
              <label class="mdv-brief-field">Estimated budget<select name="budget"></select></label>
              <label class="mdv-brief-field">Preferred timeline<select name="timeline"></select></label>
            </div>
            <label class="mdv-brief-field">Additional requirements (optional)
              <textarea name="notes" rows="3" maxlength="1000" placeholder="Rental durations, delivery areas, special requests…"></textarea></label>
            <p class="mdv-brief-hint">AI recommendations are a starting point, not a price or delivery guarantee.</p>
          </section>
          <section data-stage="1" class="mdv-brief-step" hidden>
            <div class="mdv-brief-step-heading"><span>STEP 2 OF 3</span><h3>How should we contact you?</h3>
              <p>No account required. Details are saved only after you approve and submit.</p></div>
            <label class="mdv-brief-field">Full name <em>*</em>
              <input name="name" maxlength="120" autocomplete="name" placeholder="Your full name"></label>
            <label class="mdv-brief-field">Business name (optional)
              <input name="businessName" maxlength="160" autocomplete="organization" placeholder="Your organisation"></label>
            <label class="mdv-brief-field">Email address <em>*</em>
              <input name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com"></label>
            <div class="mdv-brief-columns">
              <label class="mdv-brief-field">Phone (optional)<input name="phone" type="tel" maxlength="60" autocomplete="tel" placeholder="+27 …"></label>
              <label class="mdv-brief-field">Preferred contact<select name="contactMethod"><option>Email</option><option>Phone</option></select></label>
            </div>
            <div class="mdv-brief-permissions">
              <label><input name="consent" type="checkbox"><span>I agree to share my reviewed project brief and contact details with Mzansi Digital Ventures so the team can respond to this enquiry. <em>*</em></span></label>
              <label><input name="shareTranscript" type="checkbox"><span>Include my AI conversation (optional). My chat isn't stored unless I choose this.</span></label>
            </div>
            <p class="mdv-brief-hint">We will only use your information for this enquiry and related follow-up. Please don't share passwords or banking details.</p>
          </section>
          <section data-stage="2" class="mdv-brief-step" hidden>
            <div class="mdv-brief-step-heading"><span>STEP 3 OF 3</span><h3>Review and confirm</h3>
              <p>Check your project and contact details before sending.</p></div>
            <div class="mdv-brief-review"></div>
            <div class="mdv-brief-assurance">✓ Your enquiry will be saved in our CRM and acknowledged by email when delivery is available. No payment is collected or quotation sent automatically.</div>
          </section>
          <section data-stage="3" class="mdv-brief-step mdv-brief-success" hidden aria-live="polite">
            <span class="mdv-brief-success-icon">✓</span>
            <h3>Project brief received!</h3><p>Your enquiry has been saved for our team to review.</p>
            <div class="mdv-brief-receipt"><small>ENQUIRY REFERENCE</small><strong data-reference></strong>
              <p data-delivery>Notifications are queued for processing.</p></div>
            <p>We'll review your requirements before preparing a tailored quotation.</p>
          </section>
        </div>
        <aside class="mdv-brief-aside">
          <span>AI-ASSISTED PROJECT <b>✧</b></span>
          <h3 data-preview-title></h3><p data-preview-description></p>
          <dl><div><dt>Features</dt><dd data-preview-features></dd></div>
            <div><dt>Budget</dt><dd data-preview-budget></dd></div>
            <div><dt>Timeline</dt><dd data-preview-timeline></dd></div></dl>
          <small>Your idea remains editable until you submit it.</small>
        </aside>
      </div>
      <footer class="mdv-brief-footer">
        <p class="mdv-brief-feedback" role="status" aria-live="polite"></p>
        <div class="mdv-brief-actions"><button type="button" data-back>Back</button>
          <button type="button" data-next>Continue →</button></div>
      </footer>
    </div>`;
  document.body.append(root);
  const $=selector=>root.querySelector(selector), $$=selector=>[...root.querySelectorAll(selector)];
  const field=name=>$('[name="'+name+'"]');
  const state={
    projectType:clean(solution.projectType||"Custom business system",120),
    features:[...selected],questions:solution.question?[clean(solution.question,220)]:[]
  };
  const feedback=(message,bad=false)=>{
    $(".mdv-brief-feedback").textContent=message||"";
    $(".mdv-brief-feedback").classList.toggle("is-error",bad);
  };
  for(const [name,options] of [["budget",budgets],["timeline",timelines]]){
    const input=field(name);input.replaceChildren();
    for(const value of options){const o=document.createElement("option");o.value=value;o.textContent=value;input.append(o);}
  }
  field("title").value=clean(solution.title||"My digital business project",140);
  field("description").value=clean(answers[0],2600);
  field("summary").value=aiSummary;
  field("notes").value=clean(answers.slice(1).join("\n"),1000);
  function data(){
    return {title:clean(field("title").value,140),description:clean(field("description").value,2600),
      summary:clean(field("summary").value,1000),
      projectType:state.projectType,features:[...state.features],
      budget:field("budget").value,timeline:field("timeline").value,
      notes:clean(field("notes").value,1000),openQuestions:state.questions};
  }
  function renderFeatures(){
    const list=$(".mdv-brief-features");list.replaceChildren();
    for(const feature of state.features){
      const label=document.createElement("label");label.className="mdv-brief-feature";
      const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=true;
      checkbox.setAttribute("aria-label","Include "+feature);
      const name=document.createElement("span");name.textContent=feature;
      checkbox.addEventListener("change",()=>{
        if(!checkbox.checked)state.features=state.features.filter(x=>x!==feature);
        renderFeatures();preview();
      });
      label.append(checkbox,name);list.append(label);
    }
    $("[data-feature-count]").textContent=state.features.length+" selected";
  }
  function preview(){
    const draft=data();
    $("[data-preview-title]").textContent=draft.title||"Untitled project";
    $("[data-preview-description]").textContent=draft.description||"Your requirements will appear here.";
    $("[data-preview-features]").textContent=draft.features.length+" selected";
    $("[data-preview-budget]").textContent=draft.budget;
    $("[data-preview-timeline]").textContent=draft.timeline;
  }
  function addFeature(){
    const newFeature=clean(field("newFeature").value,160);
    if(newFeature.length<3)return feedback("Enter a feature with at least three characters.",true);
    if(state.features.length>=12)return feedback("You can add up to 12 features.",true);
    if(!state.features.includes(newFeature))state.features.push(newFeature);
    field("newFeature").value="";feedback("");renderFeatures();preview();
  }
  $("[data-add-feature]").addEventListener("click",addFeature);
  field("newFeature").addEventListener("keydown",event=>{
    if(event.key==="Enter"){event.preventDefault();addFeature();}
  });
  $$('input[name="title"],textarea[name="description"],textarea[name="notes"],select[name="budget"],select[name="timeline"]')
    .forEach(node=>node.addEventListener("input",preview));
  function validate(stage) {
    const brief=data();
    if(stage===0) {
      if(brief.title.length<4)return "Enter a project name of at least 4 characters.";
      if(brief.description.length<15)return "Describe your requirements in at least 15 characters.";
      if(brief.features.length<1)return "Choose at least one feature.";
    }
    if(stage===1){
      if(clean(field("name").value).length<2)return "Enter your full name.";
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field("email").value.trim()))
        return "Enter a valid email address.";
      if(!field("consent").checked)return "Please confirm consent to share this enquiry.";
    }
    return "";
  }
  function review(){
    const draft=data(),review=$(".mdv-brief-review");
    review.replaceChildren();
    const rows=[
      ["PROJECT",draft.title],["BUSINESS REQUIREMENTS",draft.description],
      ...(draft.summary?[["AI SUGGESTED APPROACH",draft.summary]]:[]),
      ["FEATURES",draft.features.map(x=>"✓ "+x).join("\n")],
      ["BUDGET & TIMELINE",draft.budget+" · "+draft.timeline],
      ...(draft.notes?[["ADDITIONAL REQUIREMENTS",draft.notes]]:[]),
      ["CONTACT",clean(field("name").value)+" · "+field("email").value.trim()],
      ["CONVERSATION",field("shareTranscript").checked?"Included by your choice":"Not included"]
    ];
    for(const [heading,value] of rows){
      const wrap=document.createElement("div");wrap.className="mdv-brief-review-item";
      const title=document.createElement("strong");title.textContent=heading;
      const line=document.createElement("p");line.textContent=value;
      wrap.append(title,line);review.append(wrap);
    }
  }
  function showStep(number){
    step=number;feedback("");
    $$("[data-stage]").forEach(section=>section.hidden=Number(section.dataset.stage)!==step);
    $$("[data-pill]").forEach(pill=>{
      pill.classList.toggle("is-active",Number(pill.dataset.pill)===Math.min(step,2));
      pill.classList.toggle("is-done",Number(pill.dataset.pill)<Math.min(step,2));
    });
    const back=$("[data-back]"),next=$("[data-next]");
    back.hidden=step===0||step===3;
    next.textContent=["Continue to contact details →","Review submission →","Submit project brief →","Close"][step];
    next.disabled=false;
    if(step===2)review();
    $(".mdv-brief-main").scrollTop=0;
  }
  async function submit(){
    if(submitting)return;
    submitting=true;
    const next=$("[data-next]");
    next.disabled=true;next.textContent="Submitting securely…";
    feedback("Saving your approved project brief…");
    const payload={
      submissionId,brief:data(),consent:field("consent").checked,
      shareTranscript:field("shareTranscript").checked,
      transcript:field("shareTranscript").checked?chat:[],
      contact:{name:field("name").value.trim(),email:field("email").value.trim(),
        businessName:field("businessName").value.trim(),phone:field("phone").value.trim(),
        contactMethod:field("contactMethod").value},website:""
    };
    try{
      const response=await fetch("/api/ai/leads",{method:"POST",credentials:"same-origin",
        headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.saved)throw Error(result.message||"Unable to submit your brief.");
      $("[data-reference]").textContent="AI-"+String(result.id||"").slice(-8).toUpperCase();
      $("[data-delivery]").textContent=result.notification==="sent"?
        "Admin email has been submitted for delivery. Customer acknowledgement is also queued.":
        "Your enquiry is saved. Pending notifications will be processed automatically.";
      showStep(3);
    }catch(error){feedback(error.message||"Unable to submit. Please try again.",true);}
    finally{next.disabled=false;if(step===2)next.textContent="Submit project brief →";}
    submitting=false;
  }
  $("[data-next]").addEventListener("click",async()=>{
    if(step===3)return root.close();
    const error=validate(step);
    if(error)return feedback(error,true);
    if(step===2)return submit();
    showStep(step+1);
  });
  $("[data-back]").addEventListener("click",()=>showStep(Math.max(step-1,0)));
  $(".mdv-brief-close").addEventListener("click",()=>root.close());
  root.addEventListener("click",event=>{if(event.target===root)root.close();});
  root.addEventListener("cancel",event=>{if(submitting)event.preventDefault();});
  root.addEventListener("close",()=>root.remove());
  renderFeatures();preview();showStep(0);
  root.showModal();
  field("title").focus({preventScroll:true});
  track("brief_reviewed");
}
window.MDVAiLeadFlow={open,track};
})();