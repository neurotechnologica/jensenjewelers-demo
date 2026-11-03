import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy-900 text-white shadow-sm shadow-black/5 hover:bg-navy-800 dark:bg-white dark:text-navy-950 dark:hover:bg-navy-100",
        destructive:
          "bg-red-600 text-white shadow-sm shadow-black/5 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
        outline:
          "border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-sm hover:bg-navy-50 dark:hover:bg-navy-800",
        secondary:
          "bg-navy-100 dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm hover:bg-navy-200 dark:hover:bg-navy-700",
        ghost: "hover:bg-navy-100 dark:hover:bg-navy-800",
        link: "text-navy-900 dark:text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
