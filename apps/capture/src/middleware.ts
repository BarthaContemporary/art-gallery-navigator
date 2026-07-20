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
  // Passkey sign-in endpoints must be reachable before a session exists.
  const isPublicApi = path.startsWith("/api/passkey/auth");
  // Icon / manifest / static assets must serve without a session.
  const isAsset =
    path === "/icon.svg" ||
    path === "/apple-icon.png" ||
    path === "/manifest.webmanifest" ||
    path === "/favicon.ico" ||
    path.startsWith("/icons/");
  if (!user && !isLogin && !isPublicApi && !isAsset) {
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
  // Exclude static assets and the icon/manifest routes — these must be
  // fetchable without a session (e.g. iOS reads the apple-touch-icon and
  // manifest with no cookie when adding the app to the home screen).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/).*)",
  ],
};
