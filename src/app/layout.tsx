import type { Metadata } from "next";
import { ClerkProvider, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Facet",
  description: "Personal bookmarking with time-based review",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();

  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="min-h-screen bg-black text-white antialiased">
          <header className="border-b border-zinc-800">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
              <h1 className="text-xl font-bold tracking-tight">Facet</h1>
              {userId ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal">
                  <button className="rounded-lg bg-white px-4 py-2 text-sm text-black transition-colors hover:bg-zinc-200">
                    Sign in
                  </button>
                </SignInButton>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
