// web/functions/go.js

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const targetUrl = url.searchParams.get('to');
  const partName = url.searchParams.get('part') || 'unknown';

  if (!targetUrl) {
    return new Response('Missing target URL', { status: 400 });
  }

  // Retrieve your environment variables from Cloudflare
  const supabaseUrl = context.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = context.env.PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    // Ping the Supabase REST API directly to log the click
    const logPromise = fetch(`${supabaseUrl}/rest/v1/affiliate_clicks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ 
        part_name: partName, 
        target_url: targetUrl 
      })
    });
    
    // context.waitUntil tells Cloudflare to finish saving to Supabase 
    // even AFTER the user has already been redirected, ensuring zero latency.
    context.waitUntil(logPromise);
  }

  // Instantly redirect the user to the affiliate URL
  return Response.redirect(targetUrl, 302);
}