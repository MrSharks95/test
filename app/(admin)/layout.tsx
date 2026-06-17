/**
 * Embedded admin layout.
 *
 * This route group hosts the merchant-facing app rendered inside the Shopify
 * admin (App Bridge). Session token verification and the App Bridge provider
 * are wired in Prompt 2; for now it is a structural placeholder.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="container mx-auto py-8">{children}</div>;
}
