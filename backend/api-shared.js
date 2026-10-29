export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function leerJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("json_invalido");
  }
}

export async function supabase(path, options = {}) {
  const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("database_not_configured");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(options.prefer ? { Prefer: options.prefer } : {})
  };
  const response = await fetch(`${base}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: "no-store"
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    console.error("Supabase request failed", response.status);
    const error = new Error("database_request_failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function limpiarCuponesVencidos() {
  const query = new URLSearchParams({
    expira_en: `lte.${new Date().toISOString()}`
  });
  await supabase(`dr1p_cupones?${query.toString()}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
  await supabase(`dr1p_giros?${query.toString()}`, {
    method: "DELETE",
    prefer: "return=minimal"
  });
}

export function errorResponse(error) {
  if (error?.message === "database_not_configured") {
    return json({ ok: false, error: "database_not_configured" }, 503);
  }
  if (error?.message === "json_invalido") {
    return json({ ok: false, error: "json_invalido" }, 400);
  }
  console.error("API request failed", error?.message || "unknown_error");
  return json({ ok: false, error: "server_error" }, 500);
}

export function metodoNoPermitido() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}

