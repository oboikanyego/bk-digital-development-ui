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
