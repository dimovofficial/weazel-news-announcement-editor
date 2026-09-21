const APPS_SCRIPT_URL="https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";

export default async function handler(req,res){
  try{
    const url=new URL(APPS_SCRIPT_URL);
    const incoming=new URL(req.url||"/","https://editor.local");
    incoming.searchParams.forEach((value,key)=>url.searchParams.set(key,value));
    if(!url.searchParams.has("action")) url.searchParams.set("action","index");

    const upstream=await fetch(url.toString(),{
      method:"GET",
      cache:"no-store",
      redirect:"follow",
      headers:{Accept:"application/json"}
    });

    const body=await upstream.text();
    res.setHeader("Cache-Control","no-store,max-age=0,must-revalidate");
    res.setHeader("Content-Type","application/json; charset=utf-8");

    try{
      JSON.parse(body);
    }catch{
      return res.status(502).json({
        ok:false,
        error:"Google Apps Script вернул не JSON.",
        upstreamStatus:upstream.status,
        preview:body.slice(0,300)
      });
    }

    return res.status(upstream.ok?200:502).send(body);
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:"Не удалось подключиться к Google Sheets API.",
      details:String(error?.message||error)
    });
  }
}