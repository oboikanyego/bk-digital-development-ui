import { chromium } from "playwright";
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage","--no-sandbox"]});
let issues=0;
const cases=[
 {site:"Business",url:"https://mzansi-digital-ventures.netlify.app/portfolio/",card:".more-project",title:"h3",image:"picture img"},
 {site:"Personal",url:"https://oboikanyego-portfolio.netlify.app/projects",card:".project-card",title:"h2",image:"img.project-card__image"}
];
for(const item of cases)for(const mobile of [false,true]){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1});
 const response=await page.goto(item.url,{waitUntil:"domcontentloaded",timeout:100000});
 await page.waitForTimeout(8000);
 let result=await page.evaluate(({card,title,image})=>{
   const cards=[...document.querySelectorAll(card)];
   const target=cards.find(el=>el.querySelector(title)?.textContent.trim().toLowerCase()==="kasidrop");
   if(!target)return {found:false,cards:cards.length,names:cards.map(el=>el.querySelector(title)?.textContent.trim()).slice(0,15)};
   const el=target.querySelector(image);
   if(!el)return {found:true,imageFound:false,html:target.outerHTML.slice(0,1500)};
   const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
   return {found:true,imageFound:true,src:el.src,currentSrc:el.currentSrc,complete:el.complete,
    naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,
    box:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
    display:style.display,visibility:style.visibility,opacity:style.opacity,
    cardBox:target.getBoundingClientRect().toJSON(),html:el.outerHTML};
 },{card:item.card,title:item.title,image:item.image});
 const imageUrl=result.currentSrc||result.src;
 if(imageUrl){try{const asset=await page.request.get(imageUrl,{timeout:30000});result.assetHttp=asset.status();result.assetContentType=asset.headers()["content-type"];result.assetBytes=(await asset.body()).length;}catch(e){result.assetError=String(e).slice(0,400)}}
 const summary={site:item.site,view:mobile?"mobile":"desktop",pageHttp:response?.status(),...result};
 console.log(JSON.stringify(summary));
 if(!result.found||!result.imageFound||result.naturalWidth===0||!result.box?.width||result.assetHttp!==200)issues++;
 await page.close();
}
await browser.close();
console.log("ISSUES: "+issues);
if(issues)process.exitCode=1;
