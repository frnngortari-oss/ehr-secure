"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";

type Role = "ADMIN" | "MEDICO" | "RECEPCION";

type Item = {
  href: string;
  label: string;
  icon: Parameters<typeof NavIcon>[0]["name"];
  roles?: Role[];
};

const sections: Array<{ title: string; items: Item[] }> = [
  {
    title: "General",
    items: [
      { href: "/", label: "Inicio", icon: "home" },
      { href: "/kpi", label: "KPIs", icon: "kpi" }
    ]
  },
  {
    title: "Clinica",
    items: [
      { href: "/patients", label: "Pacientes", icon: "patients" },
      { href: "/agenda", label: "Agenda", icon: "agenda" },
      { href: "/evolutions", label: "Evoluciones", icon: "evolutions" },
      { href: "/patients/new", label: "Nuevo paciente", icon: "new", roles: ["ADMIN", "RECEPCION", "MEDICO"] }
    ]
  },
  {
    title: "Admin",
    items: [
      { href: "/audit", label: "Auditoria", icon: "audit", roles: ["ADMIN"] },
      { href: "/admin/offline", label: "Backup", icon: "backup", roles: ["ADMIN"] }
    ]
  }
];

type Props = {
  role: Role;
};

export default function SidebarNav({ role }: Props) {
  const pathname = usePathname();

  return (
    <div className="sidebar-nav">
      {sections.map((section) => {
        const visibleItems = section.items.filter((item) => !item.roles || item.roles.includes(role));
        if (visibleItems.length === 0) return null;
        return (
          <section key={section.title} className="sidebar-section">
            <p className="sidebar-title">{section.title}</p>
            <div className="sidebar-links">
              {visibleItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                return (
                  <Link key={item.href} href={item.href} className={active ? "sidebar-link active" : "sidebar-link"}>
                    <NavIcon name={item.icon} className="sidebar-icon" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
