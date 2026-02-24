import Link from "next/link";
import { Main } from "@/components/ui/main";

const routeGroups: Array<{ title: string; routes: Array<{ href: string; label?: string }> }> = [
  {
    title: "Core",
    routes: [
      { href: "/", label: "Role Selector" },
      { href: "/map", label: "Link Map" },
      { href: "/login" },
      { href: "/goodbye" },
      { href: "/error" },
      { href: "/ui-system" },
      { href: "/landingPage" }
    ]
  },
  {
    title: "Website",
    routes: [
      { href: "/website" },
      { href: "/website/upgrade" },
      { href: "/available-units" },
      { href: "/available-units/[listingSlug]", label: "Dynamic Detail Template" }
    ]
  },
  {
    title: "Super Admin",
    routes: [
      { href: "/superadmin" },
      { href: "/superadmin/add-client" },
      { href: "/superadmin/clients" },
      {
        href: "/superadmin/clients/[landlordId]",
        label: "Dynamic Client Detail Template"
      },
      { href: "/superadmin/sync-settings" }
    ]
  },
  {
    title: "Landlord",
    routes: [
      { href: "/landlord" },
      { href: "/landlord/properties" },
      { href: "/landlord/tenants" },
      { href: "/landlord/listings" },
      { href: "/landlord/index.bk", label: "Backup Route" }
    ]
  },
  {
    title: "Tenant",
    routes: [{ href: "/tenant" }, { href: "/tenant/onboarding" }]
  },
  {
    title: "Onboarding",
    routes: [{ href: "/onboarding" }]
  }
];

const isTemplateRoute = (href: string): boolean => href.includes("[") || href.includes("]");

export default function MapPage() {
  return (
    <Main
      eyebrow="COLONUS"
      title="Route Link Map"
      description="Project route index for fast manual navigation."
    >
      <section id="route-map-groups-card" className="mt-4 grid gap-4 md:grid-cols-2">
        {routeGroups.map((group) => (
          <article
            key={group.title}
            id={`route-map-group-${group.title.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              {group.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {group.routes.map((route) => (
                <li key={route.href} className="text-sm">
                  {isTemplateRoute(route.href) ? (
                    <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                      <code>{route.href}</code>
                      {route.label ? <span className="ml-2 text-xs">({route.label})</span> : null}
                    </p>
                  ) : (
                    <Link
                      href={route.href}
                      className="inline-flex rounded border border-slate-200 px-2 py-1 text-slate-700 hover:border-slate-500"
                    >
                      <code>{route.href}</code>
                      {route.label ? <span className="ml-2 text-xs">({route.label})</span> : null}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </Main>
  );
}
