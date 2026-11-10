// Runs only on the published Netlify deploy. Secrets are read at runtime.
export default async function handler() {
  const token=process.env.EMAIL_JOB_TOKEN;
  if(!token){
    console.error("Email worker is disabled: EMAIL_JOB_TOKEN missing on Netlify.");
    return;
  }
  try{
    const response=await fetch("https://bk-digital-development-api.onrender.com/internal/email-jobs/run",{
      method:"POST",
      headers:{"x-email-job-token":token,"content-type":"application/json"},
      body:"{}",
      signal:AbortSignal.timeout(23500)
    });
    if(!response.ok){
      console.error("Scheduled email worker failed with HTTP",response.status);
      return;
    }
    const info=await response.json();
    console.log("Email worker checked outstanding jobs:",info.processed);
  }catch(error){
    console.error("Scheduled email worker could not reach Render.",error?.message||error);
  }
}
export const config={schedule:"*/10 * * * *"};
