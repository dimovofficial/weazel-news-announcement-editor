const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";
export default async function handler(req,res){
  try{
    const q=new URLSearchParams((req.url||"").split("?")[1]||"");
    const u=new URL(APPS_SCRIPT_URL);
    q.forEach((v,k)=>u.searchParams.set(k,v));
    if(!u.searchParams.has("action"))u.searchParams.set("action","index");
    const r=await fetch(u.toString(),{cache:"no-store",redirect:"follow"});
    const body=await r.text();
    res.setHeader("Cache-Control","no-store,max-age=0");
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.status(r.ok?200:502).send(body);
  }catch(e){res.status(500).json({ok:false,error:String(e.message||e)})}
}