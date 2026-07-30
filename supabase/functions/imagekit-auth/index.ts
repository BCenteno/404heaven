/**
 * 404heaven — imagekit-auth
 *
 * Devuelve los parámetros de autenticación que pide el SDK de ImageKit para
 * subir archivos desde el navegador:  { token, expire, signature }
 *
 * La private key de ImageKit vive en el secret IMAGEKIT_PRIVATE_KEY y nunca
 * sale de acá: el cliente solo recibe una firma que caduca.
 *
 * Secrets / variables que lee:
 *   IMAGEKIT_PRIVATE_KEY  (obligatorio) private key de ImageKit
 *   ALLOWED_ORIGINS       (opcional)    orígenes separados por coma. Por
 *                                       defecto "*" (cualquiera).
 *   REQUIRE_USER          (opcional)    "true" exige un usuario logueado de
 *                                       Supabase. Por defecto "false".
 */

// la firma vale 40 minutos (ImageKit no acepta más de 1 hora)
const EXPIRE_SECONDS = 2400;

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const REQUIRE_USER = (Deno.env.get("REQUIRE_USER") ?? "false").toLowerCase() === "true";

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    // la respuesta depende del Origin: que ningún proxy la cachee cruzada
    "Vary": "Origin",
  };

  if (ALLOWED_ORIGINS.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  // si el origen no está en la lista no se manda la cabecera y el navegador
  // corta la respuesta por su cuenta

  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store", // una firma no se cachea jamás
    },
  });
}

/** HMAC-SHA1(privateKey, message) en hexadecimal, que es lo que pide ImageKit. */
async function hmacSha1Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Valida el access token del usuario contra /auth/v1/user. Se hace con fetch
 * a pelo para no depender de ningún paquete externo en el runtime.
 */
async function hasValidUser(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;

  const url = Deno.env.get("SUPABASE_URL");
  const apikey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

  if (!url || !apikey) {
    // sin esto no se puede verificar: se falla cerrado, nunca abierto
    console.error("[imagekit-auth] faltan SUPABASE_URL / SUPABASE_ANON_KEY para verificar el usuario");
    return false;
  }

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey },
    });
    return res.ok;
  } catch (err) {
    console.error("[imagekit-auth] no se pudo verificar el usuario:", err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  // preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method not allowed" }, 405, origin);
  }

  const privateKey = Deno.env.get("IMAGEKIT_PRIVATE_KEY");
  if (!privateKey) {
    console.error("[imagekit-auth] falta el secret IMAGEKIT_PRIVATE_KEY");
    // el cliente no necesita saber qué falta exactamente
    return json({ error: "server misconfigured" }, 500, origin);
  }

  if (REQUIRE_USER && !(await hasValidUser(req))) {
    return json({ error: "unauthorized" }, 401, origin);
  }

  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + EXPIRE_SECONDS;
  // ImageKit firma la concatenación token+expire, sin separador
  const signature = await hmacSha1Hex(privateKey, `${token}${expire}`);

  return json({ token, expire, signature }, 200, origin);
});
