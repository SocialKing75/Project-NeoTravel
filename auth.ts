import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;

async function airtableGet(table: string, formula: string) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  const data = await res.json();
  return data.records?.[0] ?? null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Agents : email + mot de passe
    Credentials({
      id: "agent",
      name: "Agent",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // Bypass pour tests locaux
        if (
          credentials.email === process.env.BYPASS_AGENT_EMAIL &&
          credentials.password === process.env.BYPASS_AGENT_PASSWORD
        ) {
          return { id: "bypass", email: "user", name: "Agent Test", role: "agent" };
        }
        const record = await airtableGet("Agents", `{Email}='${credentials.email}'`);
        if (!record?.fields?.Password) return null;
        const ok = await bcrypt.compare(credentials.password as string, record.fields.Password);
        if (!ok) return null;
        return {
          id: record.id,
          email: record.fields.Email,
          name: record.fields.Nom ?? record.fields.Email,
          role: "agent",
        };
      },
    }),
    // Clients : magic link vérifié via token signé (géré dans /api/client/verify)
    Credentials({
      id: "client-token",
      name: "Client Token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        // Bypass client pour tests locaux
        if (credentials.token === "bypass") {
          return { id: "bypass-client", email: process.env.NEXT_PUBLIC_BYPASS_EMAIL ?? process.env.BYPASS_CLIENT_EMAIL ?? "client@test.fr", name: "Client Test", role: "client" };
        }
        try {
          const payload = JSON.parse(
            Buffer.from((credentials.token as string).split(".")[1], "base64url").toString()
          );
          if (payload.exp < Date.now() / 1000) return null;
          if (payload.role !== "client") return null;
          // Vérifie que l'email existe toujours en Airtable
          const record = await airtableGet("Gestion des Clients", `{Email}='${payload.email}'`);
          if (!record) return null;
          return { id: record.id, email: payload.email, name: payload.email, role: "client" };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role ?? "client";
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login?error=1",
  },
  session: { strategy: "jwt" },
});
