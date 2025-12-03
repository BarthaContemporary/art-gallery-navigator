
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-3.5 md:[&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-dark border-0",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-secondary hover:border-border-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary-light",
        accent: "bg-accent text-accent-foreground hover:bg-accent-dark border-0",
        success: "bg-success text-success-foreground hover:bg-success/90",
        premium: "bg-primary text-primary-foreground hover:bg-primary-dark border-0 font-semibold",
      },
      size: {
        default: "h-10 px-4 text-sm md:h-11 md:px-5 md:text-base",
        sm: "h-8 px-3 text-xs md:h-9 md:px-4 md:text-sm",
        lg: "h-12 px-6 text-base md:h-14 md:px-8 md:text-lg",
        icon: "h-10 w-10 md:h-11 md:w-11",
        xl: "h-14 px-8 text-lg md:h-16 md:px-10 md:text-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
