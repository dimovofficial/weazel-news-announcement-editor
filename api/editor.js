const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQWBnu8p3C-fc0sSJOT-iJhtJhJdJuO_NBBCFjjGhyNPeHUUgsEASpMMdHzOlmdwvI/exec";

export const config = {
  runtime: "edge"
};

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

    const upstream = await fetch(target.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "Accept": "application/json"
      }
    });

    const body = await upstream.text();

    try {
      JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({
        ok: false,
        error: "Google Apps Script вернул некорректный ответ.",
        upstreamStatus: upstream.status,
        preview: body.slice(0, 500)
      }), {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, max-age=0, must-revalidate"
        }
      });
    }

    return new Response(body, {
      status: upstream.ok ? 200 : 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Не удалось подключиться к Google Sheets API.",
      details: String(error && error.message ? error.message : error)
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0, must-revalidate"
      }
    });
  }
}