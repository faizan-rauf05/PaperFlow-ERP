import { redirect } from "next/navigation";

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  redirect(`/setup-password${query}`);
}
