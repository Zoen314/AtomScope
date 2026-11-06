import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtomScope · POSCAR / LAMMPS",
  description: "A private workspace for POSCAR and LAMMPS structures.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
