import { NextResponse } from "next/server";
import {
  demoSessionCookieName,
  demoSessionCookieValue,
} from "@/lib/auth/demo-cookie";
import { isDemoAuthMode } from "@/lib/auth/demo.server";

function withDemoSession(response: NextResponse) {
  response.cookies.set(demoSessionCookieName, demoSessionCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}

function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    requestUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    requestUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  if (!isDemoAuthMode()) {
    return NextResponse.json({ error: "Demo mode is not enabled." }, { status: 403 });
  }

  return withDemoSession(
    NextResponse.redirect(new URL("/", getRequestOrigin(request))),
  );
}

export async function POST() {
  if (!isDemoAuthMode()) {
    return NextResponse.json({ error: "Demo mode is not enabled." }, { status: 403 });
  }

  return withDemoSession(NextResponse.json({ ok: true }));
}
