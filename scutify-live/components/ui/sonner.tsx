"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    position="top-center"
    richColors
    closeButton
    toastOptions={{ classNames: { toast: "font-sans" } }}
    {...props}
  />
);

export { Toaster };
