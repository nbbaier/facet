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
        <body className="bg-black text-white min-h-screen antialiased">
          <header className="border-b border-zinc-800">
            <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight">Facet</h1>
              {userId ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors">
                    Sign in
                  </button>
                </SignInButton>
              )}
            </div>
          </header>
          <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
