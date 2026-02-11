import { cva } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-green-500 text-white hover:bg-green-600 active:bg-green-700 border border-green-600 shadow-sm",
        destructive:
          "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 border border-red-600 shadow-sm",
        outline:
          "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100",
        secondary:
          "bg-white text-green-700 hover:bg-green-50 active:bg-green-100 border border-green-500",
        ghost: "text-gray-700 hover:bg-gray-100 active:bg-gray-200",
        link: "text-green-600 hover:text-green-700 underline-offset-4 hover:underline active:text-green-800",
      },
      size: {
        default: "h-10 px-4 py-2 min-h-[44px] sm:min-h-[40px]",
        sm: "h-9 rounded-md px-3 min-h-[36px]",
        lg: "h-11 rounded-md px-8 min-h-[48px]",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]",
        "icon-sm": "h-8 w-8 min-h-[36px] min-w-[36px]",
        "icon-lg": "h-12 w-12 min-h-[48px] min-w-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export { buttonVariants }
