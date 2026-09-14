import { getSupabaseConfig } from "./lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const settings = getSupabaseConfig();
  if (!settings) {
    console.error("[auth-config] Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in Vercel for this deployment, then redeploy.");
    return new NextResponse("Sign-in configuration is unavailable. The site owner needs to update the Supabase environment variables and redeploy.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  try {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    settings.url,
    settings.key,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { error } = await supabase.auth.getUser();
  if (error && "status" in error && Number(error.status) >= 500) throw new Error("Auth service unavailable");
  return response;
  } catch {
    console.error("[auth-refresh] Supabase session refresh failed. Check Supabase availability and the deployment's public URL/key settings.");
    return new NextResponse("Sign-in is temporarily unavailable. Please try again shortly.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};