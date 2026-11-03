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
    if (userError || !userData.user || !userData.user.email) {
      return json({ error: "Please sign in to continue." }, 401);
    }
    const user = userData.user;

    const body = await req.json().catch(() => null);
    const packageId = typeof body?.packageId === "string" ? body.packageId : "";
    const callbackUrl = typeof body?.callbackUrl === "string" ? body.callbackUrl : "";
    if (!packageId) return json({ error: "Choose a membership package." }, 400);
    if (!/^https?:\/\/[^\s]+$/.test(callbackUrl)) return json({ error: "Invalid return address." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: pkg, error: pkgError } = await admin
      .from("membership_packages")
      .select("id, price_kobo, is_active")
      .eq("id", packageId)
      .maybeSingle();
    if (pkgError) throw pkgError;
    if (!pkg || !pkg.is_active) return json({ error: "This membership package is not available." }, 404);

    const reference = `EH-${crypto.randomUUID()}`;
    const { error: insertError } = await admin.from("payments").insert({
      user_id: user.id,
      package_id: pkg.id,
      amount_kobo: pkg.price_kobo,
      currency: "NGN",
      provider: "paystack",
      provider_reference: reference,
      status: "initialized",
    });
    if (insertError) throw insertError;

    const initResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: pkg.price_kobo,
        currency: "NGN",
        reference,
        callback_url: callbackUrl,
        metadata: { package_id: pkg.id, user_id: user.id },
      }),
    });
    const initJson = await initResponse.json().catch(() => null);

    if (!initResponse.ok || !initJson?.status || !initJson?.data?.authorization_url) {
      await admin.from("payments").update({ status: "failed" }).eq("provider_reference", reference);
      return json({ error: "We could not start the payment. Please try again." }, 502);
    }

    return json({ authorizationUrl: initJson.data.authorization_url as string, reference });
  } catch (err) {
    console.error("paystack-initialize failed", err);
    return json({ error: "Something went wrong starting your payment." }, 500);
  }
});
