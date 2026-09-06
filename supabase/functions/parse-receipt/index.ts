// Split Bill — Phase 2: reads a receipt photo with Claude's vision API and
// proposes a product list (name + price) for the owner to review before
// saving. Deployed as a Supabase Edge Function (Deno runtime).
//
// Deploy:   supabase functions deploy parse-receipt
// Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The Anthropic API key lives ONLY here (a server-side secret) — it is never
// sent to, or reachable from, the client app.

import Anthropic from "npm:@anthropic-ai/sdk@0.124.0";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk@0.124.0/helpers/zod";
import { z } from "npm:zod@4.5.4";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ReceiptSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Nombre del producto tal como aparece en la boleta"),
      price: z.number().describe("Precio del producto en la unidad de moneda de la boleta, sin símbolos ni separadores de miles"),
    })
  ),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Soft abuse guard: only accept requests carrying a real user session (not
// just the publishable/anon key). Supabase's gateway already verifies the
// JWT signature before this function runs (verify_jwt is on by default), so
// this only checks the token's role claim, not its authenticity.
function isAuthenticatedRequest(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    const token = authHeader.slice("Bearer ".length);
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "authenticated";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthenticatedRequest(req.headers.get("Authorization"))) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let imageUrl: string | undefined;
  try {
    ({ imageUrl } = await req.json());
  } catch {
    return jsonResponse({ error: "invalid_json_body" }, 400);
  }

  if (!imageUrl || typeof imageUrl !== "string") {
    return jsonResponse({ error: "missing_image_url" }, 400);
  }

  let base64Image: string;
  let mediaType: string;
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error(`fetch_failed_${imageResponse.status}`);
    mediaType = imageResponse.headers.get("content-type") ?? "image/jpeg";
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    base64Image = btoa(binary);
  } catch (err) {
    console.error("Could not fetch receipt image", err);
    return jsonResponse({ error: "could_not_fetch_image" }, 400);
  }

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      output_config: {
        format: zodOutputFormat(ReceiptSchema),
        effort: "low",
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as any, data: base64Image },
            },
            {
              type: "text",
              text:
                "Esta es la foto de una boleta de un restobar chileno, impresa en una " +
                "impresora térmica o matricial. Extrae SOLO las líneas de productos " +
                "consumidos, con su nombre y precio unitario. Ignora encabezado del " +
                "local, dirección, fecha, subtotal, total, propina, cambio y cualquier " +
                "línea que no sea un producto. El precio debe ser el número final en " +
                "pesos chilenos, sin el símbolo '$' ni separadores de miles (ej. " +
                "'4.900' se transcribe como 4900).",
            },
          ],
        },
      ],
    });

    if (!response.parsed_output) {
      return jsonResponse({ error: "could_not_parse_receipt" }, 502);
    }

    return jsonResponse({ items: response.parsed_output.items });
  } catch (err) {
    console.error("Anthropic request failed", err);
    if (err instanceof Anthropic.RateLimitError) {
      return jsonResponse({ error: "rate_limited" }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      return jsonResponse({ error: "anthropic_error", detail: err.message }, 502);
    }
    return jsonResponse({ error: "unknown_error" }, 500);
  }
});
