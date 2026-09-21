const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxSMZBGKtXhfDb3QCuQ-YAEIWc0wTmvl2JbjFOQeor_auIwoHRiYlxsfTQVqdVLmHl_/exec";

async function fetchGoogle(url) {
  let current = url;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "Accept": "application/json",
        "User-Agent": "WEAZEL-NEWS-Announcement-Editor/2.0"
      }
    });

    if (r.status >= 300 && r.status < 400) {
      const location = r.headers.get("location");
      if (!location) throw new Error("Google Apps Script returned a redirect without Location.");
      current = new URL(location, current).toString();
      continue;
    }

    return r;
  }
  throw new Error("Too many redirects from Google Apps Script.");
}

module.exports = async function handler(req, res) {
  try {
    const incoming = new URL(
      req.url || "/",
      "https://weazel-news-announcement-editor.vercel.app"
    );

    const target = new URL(APPS_SCRIPT_URL);
    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    if (!target.searchParams.has("action")) {
      target.searchParams.set("action", "categories");
    }

    const upstream = await fetchGoogle(target.toString());
    const body = await upstream.text();

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Google Apps Script вернул не JSON.",
        upstreamStatus: upstream.status,
        preview: body.slice(0, 800)
      });
    }

    if (!upstream.ok || !data.ok) {
      return res.status(502).json({
        ok: false,
        error: data.error || "Google Apps Script вернул ошибку.",
        upstreamStatus: upstream.status,
        data
      });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Ошибка прокси Google Sheets API.",
      details: String(error && error.message ? error.message : error)
    });
  }
};

module.exports.config = { runtime: "nodejs20.x" };
