import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  getLoginPassword,
  getServerWriteSecret,
  getStaffPassword,
  safeEqual,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ritardo dopo un tentativo fallito: rende inutile provare password a raffica. */
const FAILED_ATTEMPT_DELAY_MS = 600;

export async function POST(req: NextRequest) {
  const secret = getServerWriteSecret();
  if (!secret) {
    // Nessun secret configurato (sviluppo locale): nessun login necessario.
    return NextResponse.json({ ok: true, open: true });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = String(body.password ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const ownerPassword = getLoginPassword();
  const staffPassword = getStaffPassword();

  const isOwner = password.length > 0 && (safeEqual(password, ownerPassword) || safeEqual(password, secret));
  const isStaff = !isOwner && password.length > 0 && staffPassword.length > 0 && safeEqual(password, staffPassword);

  if (!isOwner && !isStaff) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_ATTEMPT_DELAY_MS));
    return NextResponse.json({ ok: false, error: "wrong_password" }, { status: 401 });
  }

  const role = isOwner ? "owner" : "staff";
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, createSessionToken(secret, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
