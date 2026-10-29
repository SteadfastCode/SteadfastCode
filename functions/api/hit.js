// Steadfast Analytics: hands one page view or action to the shared collector over a service
// binding. The visitor's IP and browser string go along so the collector can make the day's
// hash, and are not stored. Always answers 204, so analytics can never break the page.
export async function onRequestPost({ request, env, waitUntil }) {
  if (env.ANALYTICS && env.ANALYTICS_KEY && Number(request.headers.get('content-length') || 0) <= 2048) {
    const hit = {
      body: (await request.text()).slice(0, 2048),
      host: new URL(request.url).hostname,
      ip: request.headers.get('cf-connecting-ip') || '',
      ua: request.headers.get('user-agent') || '',
      country: request.cf?.country || '',
    };
    waitUntil(
      env.ANALYTICS.fetch('https://collector/collect', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-collect-key': env.ANALYTICS_KEY },
        body: JSON.stringify(hit),
      }).catch(() => {})
    );
  }
  return new Response(null, { status: 204 });
}
