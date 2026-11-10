// Same-origin API proxy. PDFs must be Base64-encoded so Netlify does not corrupt binary data.
export const handler=async(event)=>{
 const backend=(process.env.BACKEND_URL||"https://bk-digital-development-api.onrender.com").replace(/\/$/,"");
 const suffix=(event.path||"").replace(/^\/api/,"");
 const url=backend+suffix+(event.rawQuery?"?"+event.rawQuery:"");
 const headers={...event.headers};
 delete headers.host;delete headers["content-length"];delete headers.connection;
 try{
  const response=await fetch(url,{
   method:event.httpMethod,headers,
   body:["GET","HEAD"].includes(event.httpMethod)?undefined:event.isBase64Encoded?
     Buffer.from(event.body||"","base64"):event.body,
   signal:AbortSignal.timeout(80000)
  });
  const type=response.headers.get("content-type")||"application/json";
  const binary=type.toLowerCase().includes("application/pdf");
  const body=binary?Buffer.from(await response.arrayBuffer()).toString("base64"):await response.text();
  const cookieValues=typeof response.headers.getSetCookie==="function"?response.headers.getSetCookie():[];
  const cookies=cookieValues.length?cookieValues:
   (response.headers.get("set-cookie")?[response.headers.get("set-cookie")]:[]);
  const responseHeaders={"content-type":type,"cache-control":"private, no-store","x-content-type-options":"nosniff"};
  if(response.headers.get("content-disposition"))
   responseHeaders["content-disposition"]=response.headers.get("content-disposition");
  return {
   statusCode:response.status,headers:responseHeaders,isBase64Encoded:binary,
   ...(cookies.length?{multiValueHeaders:{"Set-Cookie":cookies}}:{}),body
  };
 }catch(error){
  return {statusCode:502,headers:{"content-type":"application/json","cache-control":"no-store"},
   body:JSON.stringify({message:"The service is unavailable or starting up. Please retry in a moment."})};
 }
};
