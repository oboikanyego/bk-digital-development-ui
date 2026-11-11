/* Public visitor AI project advisor (no login, no stored conversations).
 * A dedicated /ai-advisor/ page and a floating assistant on marketing pages.
 */
(() => {
  "use strict";
  const QUOTE_KEY = "mdv-ai-project-brief";
  const suggestions = [
    ["📅","I run a salon and want customers to book appointments online."],
    ["🛒","I want to sell my products online and manage orders easily."],
    ["📊","My team needs a dashboard to track clients, tasks and reports."],
    ["📱","I have a mobile app idea and need help planning the first version."]
  ];
  const pageHost = document.getElementById("aiAdvisorApp");

  const markup = () => [
    '<div class="ai-panel-header"><span class="ai-panel-icon" aria-hidden="true">✦</span>',
    '<div><p class="ai-panel-overline">YOUR DIGITAL PROJECT PARTNER</p><h2>Mzansi AI Consultant</h2></div>',
    '<span class="ai-panel-availability" data-ai-status>Checking…</span></div>',
    '<div class="ai-chat-scroll" tabindex="0" aria-label="Conversation and recommendations"><div class="ai-conversation" role="log" aria-label="AI project conversation" aria-live="polite" aria-relevant="additions">',
    '<div class="ai-bubble ai-bubble-assistant"><span class="ai-bubble-label">MZANSI AI</span>',
    '<p>Hi! Tell me about your business or app idea. I’ll suggest a practical digital solution, useful features and where to start.</p></div></div>',
    '<div class="ai-result" hidden><div class="ai-result-title"><span aria-hidden="true">✧</span>',
    '<strong data-ai-result-title>Suggested solution</strong></div>',
    '<p class="ai-result-caption">A starting point you can explore with our team</p>',
    '<div class="ai-feature-list" data-ai-features></div>',
    '<a class="ai-quote-link" href="/contact/?from=ai-advisor" data-ai-quote>Request a tailored quote <span aria-hidden="true">↗</span></a></div>',
    '<div class="ai-suggestions"><p>START WITH AN IDEA</p><div class="ai-suggestion-grid">',
    ...suggestions.map(([emoji,text],i)=>'<button type="button" class="ai-suggestion" data-ai-example="'+i+'"><span aria-hidden="true">'+emoji+'</span>'+text+'</button>'),
    '</div></div></div>',
    '<form class="ai-input-form"><label for="aiIdeaInput">What would you like to build?</label>',
    '<textarea id="aiIdeaInput" name="idea" rows="3" required minlength="15" maxlength="1200" placeholder="Describe your business, challenge or app idea…" aria-describedby="aiAdvicePrivacy"></textarea>',
    '<div class="ai-submit-row"><span class="ai-count" data-ai-count>0 / 1200</span>',
    '<button class="ai-send-button" type="submit">Get free advice <span aria-hidden="true">↗</span></button></div>',
    '<p id="aiAdvicePrivacy" class="ai-privacy">Free to explore. Don’t include passwords, banking details or private information. When live AI is enabled, your idea is processed by Groq. No chat history is saved by this site.</p>',
    '<p class="ai-feedback" role="status" aria-live="polite" hidden></p></form>'
  ].join("");

  function appendBubble(panel,kind,text) {
    const convo=panel.querySelector(".ai-conversation");
    const bubble=document.createElement("div");
    bubble.className="ai-bubble ai-bubble-"+kind;
    const label=document.createElement("span");
    label.className="ai-bubble-label";
    label.textContent=kind==="assistant"?"MZANSI AI":"YOU";
    const content=document.createElement("p");
    content.textContent=text;
    bubble.append(label,content);
    convo.appendChild(bubble);
    const scroller=panel.querySelector(".ai-chat-scroll");
    if (scroller) scroller.scrollTop=scroller.scrollHeight;
  }

  function createPanel(container) {
    container.classList.add("ai-advisor-panel");
    container.innerHTML=markup(); // Static template; never insert user/provider content as HTML.
    const form=container.querySelector(".ai-input-form");
    const textarea=form.querySelector("textarea");
    const button=form.querySelector("button[type='submit']");
    const feedback=form.querySelector(".ai-feedback");
    const result=container.querySelector(".ai-result");
    const scrollArea=container.querySelector(".ai-chat-scroll");
    const suggestionsPanel=container.querySelector(".ai-suggestions");
    const status=container.querySelector("[data-ai-status]");
    const count=container.querySelector("[data-ai-count]");
    const history=[];
    let previousIdea="", lastSuggestion=null, busy=false;

    async function health() {
      try {
        const response=await fetch("/api/ai/status",{cache:"no-store"});
        if(!response.ok)throw Error("Not ready");
        const data=await response.json();
        status.textContent=data.aiAvailable?"AI READY":"GUIDED MODE";
        status.dataset.ready=String(Boolean(data.aiAvailable));
        status.title=data.aiAvailable?"Fast responses powered by Groq":"Free rule-based recommendations are available without an AI key";
      }catch {
        status.textContent="CONNECTING…";
      }
    }

    function showMessage(text,error=false) {
      feedback.hidden=!text;
      feedback.textContent=text||"";
      feedback.classList.toggle("is-error",error);
    }

    textarea.addEventListener("input",()=>{
      count.textContent=String(textarea.value.length)+" / 1200";
      showMessage("");
    });
    container.querySelectorAll("[data-ai-example]").forEach(item=>item.addEventListener("click",()=>{
      const sample=suggestions[Number(item.dataset.aiExample)]?.[1];
      if(!sample)return;
      textarea.value=sample;
      textarea.dispatchEvent(new Event("input",{bubbles:true}));
      textarea.focus();
    }));

    async function submit(event) {
      event.preventDefault();
      if(busy||!form.reportValidity())return;
      const message=textarea.value.trim();
      if(message.length<15){showMessage("Please describe your idea in a little more detail.",true);return;}
      busy=true;
      button.disabled=true;
      button.textContent="Thinking…";
      showMessage("Creating a recommendation for your business…");
      suggestionsPanel.hidden=true;
      appendBubble(container,"user",message);
      textarea.value="";
      textarea.dispatchEvent(new Event("input",{bubbles:true}));
      try{
        const response=await fetch("/api/ai/advice",{
          method:"POST",credentials:"same-origin",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({message,history:history.slice(-4)})
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.message||"The advisor could not connect. Please try again.");
        const reply=typeof data.reply==="string"?data.reply.trim():"";
        if(!reply)throw Error("No recommendation received. Please try again.");
        appendBubble(container,"assistant",reply);
        history.push({role:"user",content:message},{role:"assistant",content:reply.slice(0,900)});
        if(history.length>4)history.splice(0,history.length-4);
        lastSuggestion=data.solution;
        previousIdea=message;
        if(data.solution?.title){
          result.hidden=false;
          result.querySelector("[data-ai-result-title]").textContent=data.solution.title;
          const target=result.querySelector("[data-ai-features]");
          target.replaceChildren();
          (Array.isArray(data.solution.features)?data.solution.features:[]).slice(0,4).forEach(feature=>{
            const chip=document.createElement("span");
            chip.textContent="✓ "+String(feature).slice(0,90);
            target.appendChild(chip);
          });
        }
        scrollArea.scrollTop=scrollArea.scrollHeight;
        status.textContent=data.mode==="ai"?"AI READY":"GUIDED MODE";
        showMessage(data.notice||"You can ask another question or request a quote.");
      }catch(error){
        appendBubble(container,"assistant","Sorry, I couldn't complete that request. Please try again or use our project enquiry form.");
        showMessage(error.message||"Unable to connect.",true);
        // Preserve the unsent idea for an easy retry.
        textarea.value=message;
        textarea.dispatchEvent(new Event("input",{bubbles:true}));
      }finally{
        busy=false;
        button.disabled=false;
        button.innerHTML='Get free advice <span aria-hidden="true">↗</span>';
      }
    }
    form.addEventListener("submit",submit);
    container.querySelector("[data-ai-quote]").addEventListener("click",()=>{
      if(!lastSuggestion||!previousIdea)return;
      const brief=[
        "AI advisor project brief",
        "My idea: "+previousIdea,
        "Suggested solution: "+lastSuggestion.title,
        "Suggested features: "+(lastSuggestion.features||[]).join(", "),
        "Please contact me to discuss the scope and a tailored quotation."
      ].join("\n\n").slice(0,4800);
      try{
        sessionStorage.setItem(QUOTE_KEY,JSON.stringify({
          createdAt:Date.now(),message:brief,projectType:lastSuggestion.projectType
        }));
      }catch{ /* storage may be blocked */ }
    });
    void health();
  }

  if(pageHost){
    createPanel(pageHost);
    return;
  }
  // Floating launchers appear on public marketing pages only.
  if(location.pathname.startsWith("/admin/"))return;
  const launcher=document.createElement("button");
  launcher.type="button";
  launcher.className="ai-advisor-launcher";
  launcher.setAttribute("aria-label","Ask Mzansi AI Consultant");
  launcher.setAttribute("aria-haspopup","dialog");
  launcher.textContent="✦ Ask Mzansi AI";
  const dialog=document.createElement("dialog");
  dialog.className="ai-advisor-dialog";
  dialog.setAttribute("aria-label","Mzansi AI Consultant");
  dialog.innerHTML='<div class="ai-widget-content"></div><a class="ai-widget-full" href="/ai-advisor/">Open full AI playground <span aria-hidden="true">↗</span></a>';
  document.body.append(launcher,dialog);
  createPanel(dialog.querySelector(".ai-widget-content"));
  const closeButton=document.createElement("button");
  closeButton.className="ai-widget-close";
  closeButton.type="button";
  closeButton.setAttribute("aria-label","Close AI consultant");
  closeButton.textContent="×";
  dialog.querySelector(".ai-panel-header").appendChild(closeButton);
  launcher.setAttribute("aria-controls","mzansiAiChatDialog");
  launcher.setAttribute("aria-expanded","false");
  dialog.id="mzansiAiChatDialog";
  launcher.addEventListener("click",()=>{
    document.body.classList.add("ai-chat-modal-open");
    dialog.showModal();
    launcher.setAttribute("aria-expanded","true");
    // Focus the scrollable chat surface rather than opening the phone keyboard.
    dialog.querySelector(".ai-chat-scroll").focus({preventScroll:true});
  });
  closeButton.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener("close",()=>{
    launcher.setAttribute("aria-expanded","false");
    document.body.classList.remove("ai-chat-modal-open");
    launcher.focus({preventScroll:true});
  });
})();
