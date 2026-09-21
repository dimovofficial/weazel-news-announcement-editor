const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";

module.exports = async function handler(req, res) {
  try {
    const incoming = new URL(req.url || "/", "https://editor.local");
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
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "User-Agent": "WEAZEL-NEWS-Announcement-Editor/1.0"
      }
    });

    const body = await upstream.text();

    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    try {
      JSON.parse(body);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Google Apps Script вернул некорректный ответ.",
        upstreamStatus: upstream.status,
        preview: body.slice(0, 500)
      });
    }

    return res.status(upstream.ok ? 200 : 502).send(body);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Не удалось подключиться к Google Sheets API.",
      details: String(error && error.message ? error.message : error)
    });
  }
};
