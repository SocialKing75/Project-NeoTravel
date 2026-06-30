import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=1", req.url));

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const email = payload.email as string;
    // Redirige vers login avec le token validé — la page login fait signIn("client-token")
    return NextResponse.redirect(
      new URL(`/login?client_token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`, req.url)
    );
  } catch {
    return NextResponse.redirect(new URL("/login?error=1", req.url));
  }
}
