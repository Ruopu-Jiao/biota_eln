"use server";

import { redirect } from "next/navigation";
import { registerUserWithPersonalWorkspace } from "@biota/db";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/auth/schemas";

function buildRegisterErrorRedirect(message: string) {
  return `/register?error=${encodeURIComponent(message)}`;
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    workspaceName: formData.get("workspaceName"),
    terms: formData.get("terms"),
  });

  if (!parsed.success) {
    redirect(
      buildRegisterErrorRedirect(
        parsed.error.issues[0]?.message ?? "Invalid registration details."
      )
    );
  }

  try {
    await registerUserWithPersonalWorkspace({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      workspaceName: parsed.data.workspaceName,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      redirect(
        buildRegisterErrorRedirect(
          "An account already exists for that email address."
        )
      );
    }

    redirect(
      buildRegisterErrorRedirect(
        "We couldn't create your account. Please try again."
      )
    );
  }

  redirect("/sign-in?registered=1");
}
