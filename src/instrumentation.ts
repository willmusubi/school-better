export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const proxy =
      process.env.https_proxy ||
      process.env.http_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY;

    if (proxy) {
      console.log(`[instrumentation] Setting up proxy for fetch: ${proxy}`);
      const { EnvHttpProxyAgent, setGlobalDispatcher } = await import("undici");
      setGlobalDispatcher(new EnvHttpProxyAgent());
    }
  }
}
