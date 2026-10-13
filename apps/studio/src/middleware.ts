import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/auth-rules";

/**
 * A browser opening the URL as a page (an export link, a typed address), as
 * opposed to a script calling it with fetch.
 */
function isPageLoad(request: NextRequest) {
  if (request.method !== "GET") return false;
  const mode = request.headers.get("sec-fetch-mode");
  if (mode) return mode === "navigate";
  return (request.headers.get("accept") ?? "").includes("text/html");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          all: { name: string; value: string; options?: Record<string, unknown> }[],
        ) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  // /set-password receives its recovery session in the URL fragment (never sent
  // to the server), so it must be reachable while signed out.
  // Icon / manifest routes must serve without a session (e.g. iOS reads the
  // apple-touch-icon and manifest with no cookie when adding to the home screen).
  const isAsset =
    path === "/icon.svg" ||
    path === "/apple-icon.png" ||
    path === "/manifest.webmanifest" ||
    path === "/favicon.ico" ||
    path.startsWith("/icons/");
  // Passkey sign-in endpoints must be reachable while signed out (they ARE
  // the sign-in); they verify the WebAuthn assertion themselves. Enrolment
  // and management endpoints stay behind the session check.
  const isPasskeyLogin = path.startsWith("/api/passkeys/login-");
  const isPublic = isLogin || isAsset || isPasskeyLogin || path.startsWith("/set-password");
  if (!user && !isPublic) {
    // Scripts calling the API get a 401 they can act on (the autosave says
    // "Signed out") instead of following a redirect to the sign-in page's
    // HTML, which a PATCH could even take as a successful save.
    if (path.startsWith("/api/") && !isPageLoad(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Pages go to sign-in with the page they asked for, so signing in lands
    // back on it (?next= is checked again where it is followed).
    const next = safeNextPath(path + request.nextUrl.search);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (next && next !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    const url = request.nextUrl.clone();
    if (next) {
      const to = new URL(next, request.nextUrl.origin);
      url.pathname = to.pathname;
      url.search = to.search;
    } else {
      url.pathname = "/";
      url.searchParams.delete("next");
    }
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Exclude machine endpoints that authenticate themselves (sync via shared
  // secret, cron). Data-export APIs stay behind the session check.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|fonts/|api/public|api/sync|api/cron).*)",
  ],
};
