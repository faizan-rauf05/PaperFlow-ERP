import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { validateCredentials } from "@/lib/validateCredentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const result = await validateCredentials(
          credentials?.email,
          credentials?.password,
        );
        return result.ok ? result.user : null;
      },
    }),
  ],
});

export const { GET, POST } = handlers;
