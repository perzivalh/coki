"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";

export interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

export interface AppShellProps {
    children: React.ReactNode;
    navItems?: NavItem[];
}

const DEFAULT_NAV: NavItem[] = [
    { href: "/dashboard/today", label: "Home", icon: "🏠" },
    { href: "/dashboard/month", label: "Month", icon: "📅" },
    { href: "/dashboard/history", label: "History", icon: "🕐" },
    { href: "/dashboard/budget", label: "Budget", icon: "💎" },
    { href: "/dashboard/summary", label: "Summary", icon: "🧾" },
    { href: "/dashboard/settings/finance", label: "Finance", icon: "💸" },
    { href: "/dashboard/settings/fixed-bills", label: "Fixed Bills", icon: "📋" },
    { href: "/dashboard/settings/categories", label: "Categorías", icon: "🏷️" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export function AppShell({ children, navItems = DEFAULT_NAV }: AppShellProps) {
    const pathname = usePathname();

    return (
        <div className={styles.shell}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarTop}>
                    <div className={styles.brand}>
                        <span className={styles.brandLogo}>🤖</span>
                        <div>
                            <p className={styles.brandName}>Coki Finance</p>
                            <p className={styles.brandSub}>Wallet Tracker</p>
                        </div>
                    </div>
                    <nav className={styles.nav}>
                        {navItems.map((item) => {
                            const isActive =
                                pathname === item.href ||
                                (item.href !== "/dashboard/today" && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                                >
                                    <span className={styles.navIcon}>{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
                <div className={styles.sidebarBottom}>
                    <p className={styles.ownerName}>Owner</p>
                    <p className={styles.ownerEmail}>coki@local</p>
                </div>
            </aside>

            {/* Main content */}
            <main className={styles.content}>{children}</main>
        </div>
    );
}
