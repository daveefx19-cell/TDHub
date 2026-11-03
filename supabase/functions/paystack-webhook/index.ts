import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
    const mode = Deno.env.get("PAYSTACK_MODE") ?? "test";

    if (!secretKey || (mode === "live" ? !secretKey.startsWith("sk_live_") : !secretKey.startsWith("sk_test_"))) {
      return json({ error: "Webhook not configured." }, 503);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    const expected = await hmacSha512Hex(secretKey, rawBody);
    if (!constantTimeEqual(signature, expected)) {
      return json({ error: "Invalid signature." }, 401);
    }

    const event = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
    if (event.event !== "charge.success" || !event.data?.reference) {
      return json({ received: true, ignored: true });
    }

    const reference = event.data.reference;
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const verifyJson = await verifyResponse.json().catch(() => null);
    if (!verifyResponse.ok || !verifyJson?.status || !verifyJson?.data) {
      throw new Error("Paystack verification failed");
    }

    const transaction = verifyJson.data as { status: string; amount: number; currency: string; paid_at: string | null };
    if (transaction.status !== "success") {
      return json({ received: true, paymentStatus: transaction.status });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { error: rpcError } = await admin.rpc("complete_paystack_payment", {
      p_reference: reference,
      p_amount_kobo: transaction.amount,
      p_currency: transaction.currency,
      p_paid_at: transaction.paid_at,
    });
    if (rpcError) {
      console.error("complete_paystack_payment rejected", rpcError.message);
      return json({ received: true, activated: false }, 422);
    }

    return json({ received: true, activated: true });
  } catch (err) {
    console.error("paystack-webhook failed", err);
    return json({ error: "Webhook processing failed." }, 500);
  }
});
