import Navigation from "@/components/Navigation";
import HeroBanner from "@/components/HeroBanner";
import { prisma } from "@/lib/db";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

// The admin page itself is not gated — anyone can VIEW the form, but every save
// goes through /api/admin/results which checks ADMIN_TOKEN. The page still asks
// for the token in the UI so a typo doesn't silently break anything.
export default async function AdminPage() {
  const teams = await prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }] });
  const pools = await prisma.pool.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <Navigation />
      <HeroBanner />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <h1 className="text-3xl font-bold mb-2">Admin</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Enter the admin token (the one you set as <code>ADMIN_TOKEN</code> on Vercel)
          to update results and lock pools.
        </p>
        <AdminClient teams={teams} pools={pools.map((p) => ({ id: p.id, name: p.name, joinCode: p.joinCode, locked: p.locked }))} />
      </main>
    </>
  );
}
