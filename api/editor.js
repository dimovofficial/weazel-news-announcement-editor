const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";

export const config = {
  runtime: "edge"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

export default async function handler(request) {
  try {
    const incoming = new URL(request.url);
    const target = new URL(APPS_SCRIPT_URL);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    if (!target.searchParams.has("action")) {
      target.searchParams.set("action", "index");
    }

    let url = target.toString();
    let upstream = null;

    for (let i = 0; i < 6; i++) {
      upstream = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: {
          "Accept": "application/json",
          "User-Agent": "WEAZEL-NEWS-Announcement-Editor/1.0"
        }
      });

      if (![301, 302, 303, 307, 308].includes(upstream.status)) {
        break;
      }

      const location = upstream.headers.get("location");
      if (!location) {
        return json({
          ok: false,
          error: "Google Apps Script вернул перенаправление без адреса.",
          upstreamStatus: upstream.status
        }, 502);
      }

      url = new URL(location, url).toString();
    }

    if (!upstream) {
      return json({ok:false,error:"Не удалось получить ответ от Google Apps Script."}, 502);
    }

    const body = await upstream.text();

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return json({
        ok: false,
        error: "Google Apps Script вернул не JSON.",
        upstreamStatus: upstream.status,
        preview: body.slice(0, 300)
      }, 502);
    }

    return json(parsed, upstream.ok ? 200 : 502);
  } catch (error) {
    return json({
      ok: false,
      error: "Ошибка прокси Google Sheets API.",
      details: String(error && error.message ? error.message : error)
    }, 502);
  }
}