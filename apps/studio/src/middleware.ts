import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Exclude machine endpoints that authenticate themselves (sync via shared
  // secret, cron). Data-export APIs stay behind the session check.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|api/public|api/sync|api/cron).*)",
  ],
};
