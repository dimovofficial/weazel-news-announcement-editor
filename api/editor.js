const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";

module.exports = async function handler(req, res) {
  try {
    const incoming = new URL(req.url || "/", "https://weazel-news-announcement-editor.vercel.app");
    const target = new URL(APPS_SCRIPT_URL);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    if (!target.searchParams.has("action")) {
      target.searchParams.set("action", "index");
    }

    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "Accept": "application/json",
        "User-Agent": "WEAZEL-NEWS-Announcement-Editor/1.0"
      }
    });

    const body = await upstream.text();

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Google Apps Script вернул не JSON.",
        upstreamStatus: upstream.status,
        preview: body.slice(0, 500)
      });
    }

    return res.status(upstream.ok ? 200 : 502).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Ошибка прокси Google Sheets API.",
      details: String(error && error.message ? error.message : error)
    });
  }
};

module.exports.config = {
  runtime: "nodejs20.x"
};
