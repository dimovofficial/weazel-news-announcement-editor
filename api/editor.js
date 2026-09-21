const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";
const CATEGORY_LIMIT = 30;
const SEARCH_LIMIT = 30;

module.exports = async function handler(req, res) {
  try {
    const incoming = new URL(req.url || "/", "https://weazel-news-announcement-editor.vercel.app");
    const target = new URL(APPS_SCRIPT_URL);

    incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));
    if (!target.searchParams.has("action")) target.searchParams.set("action", "index");

    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: { "Accept": "application/json", "User-Agent": "WEAZEL-NEWS-Announcement-Editor/1.0" }
    });

    const body = await upstream.text();
    let data;
    try { data = JSON.parse(body); }
    catch {
      return res.status(502).json({ok:false,error:"Google Apps Script вернул не JSON.",upstreamStatus:upstream.status,preview:body.slice(0,500)});
    }

    if (!upstream.ok || !data.ok) return res.status(502).json(data);

    const query = String(incoming.searchParams.get("q") || "").trim().toLowerCase();
    const category = String(incoming.searchParams.get("category") || "").trim();
    const allItems = Array.isArray(data.items) ? data.items : [];

    let filtered = category ? allItems.filter(item => String(item.sheetName || "") === category) : allItems;

    if (query) {
      filtered = filtered.filter(item => {
        const haystack = [item.sheetName,item.value,...(Array.isArray(item.options)?item.options:[])].join(" ").toLowerCase();
        return haystack.includes(query);
      }).slice(0, SEARCH_LIMIT);
    } else {
      filtered = filtered.slice(0, CATEGORY_LIMIT);
    }

    const result = {
      ok:true,
      items:filtered,
      total:allItems.length,
      categoryTotal:category ? allItems.filter(item=>String(item.sheetName||"")===category).length : allItems.length,
      returned:filtered.length,
      category:category || null
    };

    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","no-store, max-age=0, must-revalidate");
    res.setHeader("Access-Control-Allow-Origin","*");
    return res.status(200).json(result);
  } catch(error) {
    return res.status(502).json({ok:false,error:"Ошибка прокси Google Sheets API.",details:String(error&&error.message?error.message:error)});
  }
};

module.exports.config = { runtime:"nodejs20.x" };
