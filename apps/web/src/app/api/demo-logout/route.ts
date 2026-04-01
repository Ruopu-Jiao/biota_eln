import { NextResponse } from "next/server";
import { demoSessionCookieName } from "@/lib/auth/demo-cookie";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(demoSessionCookieName);

  return response;
}
