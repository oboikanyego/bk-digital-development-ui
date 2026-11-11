/* Mzansi AI project brief → CRM lead conversion.
 * Visitor must review the brief and explicitly consent; anonymous chats are
 * never stored automatically. No provider keys or sensitive data in URLs.
 */
(() => {
  "use strict";
  if (window.MDVAILeadWizard) return;
  const max = (text,length) => String(text||"").trim().slice(0,length);
  const make = (tag,cl,text) => {
    const n=document.createElement(tag);
    if(cl)n.className=cl;
    if(text!==undefined)n.textContent=text;
    return n;
  };
  function field(label,input) {
    const node=make("label","aiw-field");
    node.append(make("span","aiw-field-title",label),input);
    return node;
  }
  function textInput(name,initial,maxLength,required=false,type="text") {
    const input=make("input","aiw-input");
    input.name=name;input.type=type;input.maxLength=maxLength;input.required=required;input.value=initial||"";
    return input;
  }
  function area(name,initial,limit,rows=4) {
    const el=make("textarea","aiw-input");
    el.name=name;el.maxLength=limit;el.rows=rows;el.value=initial||"";
    return el;
  }
  function select(name,options,value) {
    const el=make("select","aiw-input");el.name=name;
    for(const option of options) {
      const n=make("option",null,option);n.value=option;el.append(n);
    }
    el.value=value||options[0];return el;
  }
  const budget=["Not sure yet","Under R5,000","R5,000–R15,000","R15,000–R50,000","R50,000+"];
  const timeline=["Flexible","ASAP","1–2 months","3–6 months","6+ months"];
  const tracker=event=>{
    if(!["opened","idea_submitted","brief_reviewed"].includes(event))return;
    try{void fetch("/api/ai/events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event}),keepalive:true}).catch(()=>{});}
    catch{/* Analytics must never prevent enquiry completion. */}
  };

  function open({solution,answers=[],transcript=[],reply=""}={}) {
    if(!solution?.title || !Array.isArray(solution.features) || !solution.features.length) return;
    const original=document.activeElement;
    const previous=document.querySelector(".aiw-overlay");
    if(previous)previous.remove();

    const context=answers.join(" ").toLowerCase();
    const mascot=context.includes("mascot");
    const name=mascot && solution.category==="commerce-rentals" ?
      "Mascot Sales & Rental Platform" : max(solution.title,140);
    const description=answers.length ?
      max([answers[0],...answers.slice(1).map(x=>"Additional requirement: "+x)].join("\n\n"),2600) :
      "I'd like a website that supports the features recommended by Mzansi AI Consultant.";
    const data={
      title:name,
      description,
      summary:max(reply,1000),
      projectType:max(solution.projectType||"Custom business system",120),
      budget:"Not sure yet",timeline:"Flexible",notes:"",
      features:[...new Set(solution.features.map(x=>max(x,160)))].slice(0,12),
      openQuestions:solution.question?[max(solution.question,220)]:[]
    };
    const contact={name:"",email:"",phone:"",businessName:"",contactMethod:"Email"};
    let stage=0,consent=false,shareTranscript=false,sending=false;
    const submissionId=crypto.randomUUID();

    const dialog=make("dialog","aiw-overlay");
    dialog.setAttribute("aria-label","Review and submit your AI project brief");
    const shell=make("div","aiw-shell");
    const header=make("header","aiw-header");
    const brand=make("div","aiw-brand");
    const brandMark=make("span","aiw-mark","✦");brandMark.setAttribute("aria-hidden","true");
    const brandText=make("div",null);
    brandText.append(make("strong",null,"MZANSI DIGITAL VENTURES"),make("small",null,"AI Project Discovery Studio"));
    brand.append(brandMark,brandText);
    const close=make("button","aiw-close","×");close.type="button";close.setAttribute("aria-label","Close project brief");
    close.addEventListener("click",()=>dialog.close());
    header.append(brand,close);
    const title=make("h2","aiw-title","Review your project brief");
    const intro=make("p","aiw-intro","");
    const progress=make("div","aiw-progress");
    const body=make("section","aiw-body");
    body.setAttribute("aria-live","polite");
    const feedback=make("p","aiw-feedback");
    feedback.setAttribute("role","status");
    feedback.setAttribute("aria-live","polite");
    const actions=make("footer","aiw-actions");
    shell.append(header,title,intro,progress,body,feedback,actions);
    dialog.append(shell);document.body.append(dialog);
    const steps=["Review brief","Your details","Confirm","Complete"];

    const error=message=>{
      feedback.textContent=message||"";
      feedback.classList.toggle("is-error",Boolean(message));
    };
    const button=(label,kind,callback,disabled=false)=>{
      const el=make("button","aiw-button "+kind,label);
      el.type="button";el.disabled=disabled;
      el.addEventListener("click",callback);
      return el;
    };
    function renderProgress(){
      progress.replaceChildren();
      steps.forEach((label,i)=>{
        const node=make("span","aiw-progress-step "+(stage===i?"current":stage>i?"done":""));
        node.textContent=(i+1)+". "+label;progress.append(node);
      });
    }
    function captureBrief(){
      const f=body.querySelector("#aiwBriefForm");
      if(!f||!f.reportValidity())return false;
      const fd=new FormData(f);
      Object.assign(data,{
        title:max(fd.get("title"),140),description:max(fd.get("description"),2600),
        summary:max(fd.get("summary"),1000),budget:fd.get("budget"),
        timeline:fd.get("timeline"),notes:max(fd.get("notes"),1000)
      });
      const selected=[...f.querySelectorAll('[name="feature"]:checked')].map(x=>x.value);
      data.features=[...new Set(selected)].slice(0,12);
      if(!data.features.length){error("Select at least one feature to continue.");return false;}
      return true;
    }
    function captureContact(){
      const f=body.querySelector("#aiwContactForm");
      if(!f||!f.reportValidity())return false;
      const fd=new FormData(f);
      for(const key of Object.keys(contact))contact[key]=max(fd.get(key),key==="email"?254:key==="businessName"?160:key==="phone"?60:120);
      consent=Boolean(f.querySelector('[name="consent"]').checked);
      shareTranscript=Boolean(f.querySelector('[name="shareTranscript"]').checked);
      if(!consent){error("Please agree to share this project brief for your enquiry.");return false;}
      return true;
    }
    function go(index){stage=index;render();}

    function drawBrief(){
      const form=make("form","aiw-form");form.id="aiwBriefForm";
      form.append(field("Project name *",textInput("title",data.title,140,true)));
      const requirements=area("description",data.description,2600,5);requirements.required=true;requirements.minLength=15;
      form.append(field("Business requirements *",requirements));
      form.append(field("AI recommendation (editable)",area("summary",data.summary,1000,3)));
      const featureWrap=make("div","aiw-feature-box");
      featureWrap.append(make("h3",null,"Suggested features"),make("p","aiw-small","Choose what you want in the first version. Remove any feature that doesn't fit."));
      const list=make("div","aiw-feature-list");list.id="aiwFeatures";
      function addFeature(value,checked=true){
        if(!value||[...list.querySelectorAll("input")].some(x=>x.value===value))return;
        if(list.children.length>=12){error("You can include up to 12 features.");return;}
        const label=make("label","aiw-feature");
        const box=make("input");box.type="checkbox";box.name="feature";box.value=value;box.checked=checked;
        label.append(box,make("span",null,value));list.append(label);
      }
      data.features.forEach(x=>addFeature(x));
      featureWrap.append(list);
      const addRow=make("div","aiw-add-feature");
      const custom=textInput("newFeature","",160,false);custom.placeholder="Add a missing feature…";
      const addButton=button("+ Add","outline",()=>{
        const value=max(custom.value,160);
        if(value.length<3){error("Describe your feature in at least three characters.");return;}
        error("");addFeature(value);custom.value="";
      });
      addRow.append(custom,addButton);featureWrap.append(addRow);form.append(featureWrap);
      const columns=make("div","aiw-columns");
      columns.append(field("Budget",select("budget",budget,data.budget)),
        field("Preferred timeline",select("timeline",timeline,data.timeline)));
      form.append(columns);
      form.append(field("Additional notes",area("notes",data.notes,1000,3)));
      body.append(form);
      actions.append(button("Cancel","outline",()=>dialog.close()),
        button("Continue to contact details →","primary",()=>{
          if(captureBrief()){tracker("brief_reviewed");go(1);}
        }));
    }

    function drawContact(){
      const form=make("form","aiw-form");form.id="aiwContactForm";
      const fields=make("div","aiw-columns");
      fields.append(
        field("Full name *",textInput("name",contact.name,120,true)),
        field("Business name",textInput("businessName",contact.businessName,160)),
        field("Email address *",textInput("email",contact.email,254,true,"email")),
        field("Phone number (optional)",textInput("phone",contact.phone,60,false,"tel"))
      );
      form.append(fields);
      form.append(field("Preferred contact method",select("contactMethod",["Email","Phone"],contact.contactMethod)));
      const consentLabel=make("label","aiw-consent");
      const checkbox=make("input");checkbox.type="checkbox";checkbox.name="consent";checkbox.checked=consent;checkbox.required=true;
      consentLabel.append(checkbox,make("span",null,
        "I agree to share my contact details and reviewed project brief with Mzansi Digital Ventures for this enquiry. *"));
      const historyLabel=make("label","aiw-consent");
      const historyBox=make("input");historyBox.type="checkbox";historyBox.name="shareTranscript";historyBox.checked=shareTranscript;
      historyLabel.append(historyBox,make("span",null,
        "Include up to 12 messages from my AI conversation (optional)."));
      form.append(consentLabel,historyLabel);
      const caveat=make("p","aiw-small","Your chat stays private unless you choose to include it. No account or payment is required.");
      form.append(caveat);
      body.append(form);
      actions.append(button("← Back","outline",()=>{captureContact();go(0);}),
        button("Review submission →","primary",()=>{if(captureContact())go(2);}));
    }

    function summaryRow(label,value) {
      const row=make("div","aiw-summary-row");
      row.append(make("span",null,label),make("strong",null,value||"—"));return row;
    }
    function drawConfirmation(){
      const brief=make("div","aiw-summary");
      brief.append(make("h3",null,data.title),make("p",null,data.description),
        make("h4",null,"Selected features"));
      const ul=make("ul");
      data.features.forEach(x=>ul.append(make("li",null,x)));brief.append(ul);
      brief.append(summaryRow("Budget",data.budget),summaryRow("Timeline",data.timeline));
      if(data.notes)brief.append(make("p",null,"Notes: "+data.notes));
      if(data.openQuestions?.length)brief.append(make("p",null,"To clarify: "+data.openQuestions.join(" · ")));
      body.append(brief);
      const details=make("div","aiw-summary");
      details.append(make("h3",null,"Contact information"),
        summaryRow("Customer",contact.name),summaryRow("Business",contact.businessName),
        summaryRow("Email",contact.email),summaryRow("Preferred contact",contact.contactMethod),
        summaryRow("AI conversation included",shareTranscript?"Yes":"No"));
      body.append(details);
      const note=make("p","aiw-small",
        "Submitting creates a CRM enquiry and queues an acknowledgement and admin notification. A quotation will only be sent after the team reviews and prices your project.");
      body.append(note);
      actions.append(button("← Edit details","outline",()=>go(1)),
        button("Submit project brief →","primary",submit));
    }

    async function submit(){
      if(sending)return;
      sending=true;error("");
      const send=actions.querySelector(".primary");send.disabled=true;send.textContent="Submitting securely…";
      const payload={
        submissionId,consent:true,shareTranscript,
        brief:data,contact,
        ...(shareTranscript?{transcript:transcript.filter(x=>["assistant","user"].includes(x.role))
          .slice(-12).map(x=>({role:x.role,content:max(x.content,900)}))}:{})
      };
      try{
        const response=await fetch("/api/ai/leads",{
          method:"POST",credentials:"same-origin",
          headers:{"content-type":"application/json"},
          body:JSON.stringify(payload)
        });
        const result=await response.json().catch(()=>({}));
        if(!response.ok || !result.saved)
          throw Error(result.message||"Your project brief could not be submitted.");
        stage=3;render(result);
      }catch(err){
        error(err.message||"Unable to submit. Your draft is still here. Please retry.");
        send.disabled=false;send.textContent="Try submitting again →";
      }finally{sending=false;}
    }
    function drawSuccess(receipt){
      const success=make("div","aiw-success");
      success.append(make("div","aiw-success-mark","✓"),
        make("h3",null,"Your project brief has been received"),
        make("p",null,"Thank you! Mzansi Digital Ventures can now review your requirements and prepare the next steps."));
      const reference=make("p","aiw-reference","Enquiry reference: "+String(receipt?.id||"").slice(0,24));
      success.append(reference);
      if(receipt?.notification==="pending"){
        success.append(make("p","aiw-small","Your enquiry is saved. Email notifications are queued or awaiting delivery."));
      }
      body.append(success);
      actions.append(button("Close","primary",()=>dialog.close()));
    }

    function render(receipt) {
      body.replaceChildren();actions.replaceChildren();error("");renderProgress();
      const headings=[
        ["Review your AI project brief","Make sure the suggested requirements and features reflect what you actually need."],
        ["How can we contact you?","Provide your details and choose whether to share the AI conversation."],
        ["Ready to submit?","Review everything before creating your CRM enquiry."],
        ["Project brief submitted","You'll receive an acknowledgement when email delivery is available."]
      ];
      title.textContent=headings[stage][0];intro.textContent=headings[stage][1];
      if(stage===0)drawBrief();
      else if(stage===1)drawContact();
      else if(stage===2)drawConfirmation();
      else drawSuccess(receipt);
      const focus=body.querySelector("input,textarea,button")||actions.querySelector("button");
      focus?.focus({preventScroll:true});
    }
    dialog.addEventListener("close",()=>{
      dialog.remove();
      if(original?.isConnected)original.focus({preventScroll:true});
    });
    dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
    dialog.showModal();
    render();
  }

  window.MDVAILeadWizard={open};
  window.addEventListener("mdv-ai-project-brief",event=>open(event.detail));
})();
