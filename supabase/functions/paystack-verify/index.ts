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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
    const mode = Deno.env.get("PAYSTACK_MODE") ?? "test";

    if (!secretKey || (mode === "live" ? !secretKey.startsWith("sk_live_") : !secretKey.startsWith("sk_test_"))) {
      return json({ error: "Online payments are not configured yet." }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Please sign in to continue." }, 401);

    const body = await req.json().catch(() => null);
    const reference = typeof body?.reference === "string" ? body.reference : "";
    if (!/^[A-Za-z0-9._=-]{1,100}$/.test(reference)) return json({ error: "Invalid payment reference." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("provider_reference, user_id, amount_kobo, currency, status")
      .eq("provider_reference", reference)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return json({ error: "Payment not found." }, 404);

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const verifyJson = await verifyResponse.json().catch(() => null);
    if (!verifyResponse.ok || !verifyJson?.status || !verifyJson?.data) {
      return json({ error: "We could not confirm this payment yet. Please try again shortly." }, 502);
    }

    const transaction = verifyJson.data as { status: string; amount: number; currency: string; paid_at: string | null };

    if (transaction.status !== "success") {
      if (transaction.status === "failed" || transaction.status === "abandoned") {
        await admin
          .from("payments")
          .update({ status: transaction.status })
          .eq("provider_reference", reference)
          .neq("status", "success");
      }
      return json({ activated: false, paymentStatus: transaction.status });
    }

    const { data: membership, error: rpcError } = await admin.rpc("complete_paystack_payment", {
      p_reference: reference,
      p_amount_kobo: transaction.amount,
      p_currency: transaction.currency,
      p_paid_at: transaction.paid_at,
    });
    if (rpcError) {
      console.error("complete_paystack_payment rejected", rpcError.message);
      return json({ error: "This payment could not be matched to a membership. Please contact support." }, 422);
    }

    return json({ activated: true, paymentStatus: "success", membership });
  } catch (err) {
    console.error("paystack-verify failed", err);
    return json({ error: "Something went wrong confirming your payment." }, 500);
  }
});
