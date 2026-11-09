const form=document.getElementById("loginForm");
const status=document.getElementById("loginError");
const submit=document.getElementById("loginButton");
const home="/admin/dashboard/";
async function checkSession(){
  try{
    const response=await fetch("/api/admin/auth/me",{credentials:"same-origin",cache:"no-store"});
    if(response.ok)location.replace(home);
  }catch{}
}
checkSession();
form.addEventListener("submit",async event=>{
  event.preventDefault();
  status.textContent="";
  submit.disabled=true;
  submit.textContent="Signing in…";
  try{
    const response=await fetch("/api/admin/auth/login",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        email:document.getElementById("email").value.trim(),
        password:document.getElementById("password").value
      })
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.message||"Unable to sign in.");
    document.getElementById("password").value="";
    location.replace(home);
  }catch(error){
    status.textContent=error.message||"Admin sign-in is temporarily unavailable.";
    submit.disabled=false;
    submit.textContent="Sign in securely →";
  }
});

const keyForm=document.getElementById("keyForm");
const switchKey=document.getElementById("showKeyLogin");
const switchBack=document.getElementById("showPasswordLogin");
switchKey.addEventListener("click",()=>{
  form.hidden=true;
  switchKey.hidden=true;
  keyForm.hidden=false;
  status.textContent="";
  document.getElementById("accessKey").focus();
});
switchBack.addEventListener("click",()=>{
  keyForm.hidden=true;
  form.hidden=false;
  switchKey.hidden=false;
  document.getElementById("accessKey").value="";
  status.textContent="";
  document.getElementById("email").focus();
});
keyForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("keyButton");
  button.disabled=true;
  button.textContent="Verifying…";
  status.textContent="";
  try{
    const response=await fetch("/api/admin/auth/login",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({accessKey:document.getElementById("accessKey").value.trim()})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.message||"Access denied.");
    document.getElementById("accessKey").value="";
    location.replace(home);
  }catch(error){
    status.textContent=error.message||"Unable to sign in.";
    button.disabled=false;
    button.textContent="Access dashboard →";
  }
});
