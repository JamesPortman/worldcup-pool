import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

// The page renders NOTHING sensitive — no pools, join codes, or player data.
// AdminClient fetches that from /api/admin/data only after the ADMIN_TOKEN is
// verified, so visiting /admin without the token leaks nothing.
export default function AdminPage() {
  return (
    <>
      <Navigation />
      <HeroBanner />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <h1 className="text-3xl font-bold mb-2">Admin</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Enter the admin token (the one you set as <code>ADMIN_TOKEN</code> on Vercel)
          to unlock results entry and pool controls.
        </p>
        <AdminClient />
      </main>
    </>
  );
}
