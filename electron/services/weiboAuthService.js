export function createWeiboAuthService({
  session,
  store,
  cookieDomain,
}) {
  async function getWeiboCookieFromSession() {
    const cookies = await session.defaultSession.cookies.get({ domain: cookieDomain });
    const cookieString = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    return cookieString.includes("SUB=") ? cookieString : "";
  }

  async function clearWeiboSession() {
    const cookies = await session.defaultSession.cookies.get({ domain: cookieDomain });
    await Promise.all(
      cookies.map((cookie) =>
        session.defaultSession.cookies.remove(
          `https://${cookie.domain.replace(/^\./, "")}${cookie.path || "/"}`,
          cookie.name,
        ),
      ),
    );
    store.delete("weibo_cookie");
  }

  function saveWeiboCookie(cookieString) {
    if (cookieString) {
      store.set("weibo_cookie", cookieString);
    }
  }

  function getStoredCookie() {
    return store.get("weibo_cookie") || "";
  }

  return {
    getWeiboCookieFromSession,
    clearWeiboSession,
    saveWeiboCookie,
    getStoredCookie,
  };
}
