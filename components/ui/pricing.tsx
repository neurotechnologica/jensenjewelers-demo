"use client";

import { motion, useSpring, useScroll, useTransform } from "framer-motion";
import React, {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";
import confetti from "canvas-confetti";
import { Check, Star as LucideStar } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { DottedSurface } from "./dotted-surface";

// --- UTILITY FUNCTIONS ---

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

// --- BASE UI COMPONENTS (BUTTON) ---

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-navy-900 text-white dark:bg-white dark:text-navy-950 hover:opacity-90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-navy-200 bg-transparent hover:bg-navy-50 dark:border-navy-800 dark:hover:bg-navy-900 dark:text-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-full px-8 uppercase text-[10px] font-bold tracking-widest",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

// --- INTERACTIVE STARFIELD ---

function Star({
  mousePosition,
  containerRef,
}: {
  mousePosition: { x: number | null; y: number | null };
  containerRef: React.RefObject<HTMLDivElement>;
  key?: React.Key;
}) {
  const [initialPos] = useState({
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
  });

  const springConfig = { stiffness: 100, damping: 15, mass: 0.1 };
  const springX = useSpring(0, springConfig);
  const springY = useSpring(0, springConfig);

  useEffect(() => {
    if (
      !containerRef.current ||
      mousePosition.x === null ||
      mousePosition.y === null
    ) {
      springX.set(0);
      springY.set(0);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const starX =
      containerRect.left +
      (parseFloat(initialPos.left) / 100) * containerRect.width;
    const starY =
      containerRect.top +
      (parseFloat(initialPos.top) / 100) * containerRect.height;

    const deltaX = mousePosition.x - starX;
    const deltaY = mousePosition.y - starY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const radius = 600; // Radius of magnetic influence

    if (distance < radius) {
      const force = 1 - distance / radius;
      const pullX = deltaX * force * 0.5;
      const pullY = deltaY * force * 0.5;
      springX.set(pullX);
      springY.set(pullY);
    } else {
      springX.set(0);
      springY.set(0);
    }
  }, [mousePosition, initialPos, containerRef, springX, springY]);

  return (
    <motion.div
      className="absolute bg-navy-950 dark:bg-white rounded-full"
      style={{
        top: initialPos.top,
        left: initialPos.left,
        width: `${1.5 + Math.random() * 2.5}px`,
        height: `${1.5 + Math.random() * 2.5}px`,
        x: springX,
        y: springY,
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [0, 0.8, 0] }}
      transition={{
        duration: 2 + Math.random() * 3,
        repeat: Infinity,
        delay: Math.random() * 5,
      }}
    />
  );
}

function InteractiveStarfield({
  mousePosition,
  containerRef,
}: {
  mousePosition: { x: number | null; y: number | null };
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
      {Array.from({ length: 100 }).map((_, i) => (
        <Star
          key={`star-${i}`}
          mousePosition={mousePosition}
          containerRef={containerRef}
        />
      ))}
    </div>
  );
}

// --- PRICING COMPONENT LOGIC ---

// Interfaces
export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  yearlyPrice: number;
  setupFee: number;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  isPopular?: boolean;
}

interface PricingSectionProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  onSelect: (id: string) => void;
  hideAmounts?: boolean;
}

// Context for state management
const PricingContext = createContext<{
  isMonthly: boolean;
  setIsMonthly: (value: boolean) => void;
}>({
  isMonthly: true,
  setIsMonthly: () => {},
});

// Main PricingSection Component
export function PricingSection({
  plans,
  title = "Simple, Transparent Pricing",
  description = "Choose the plan that's right for you. All plans include our core features and support.",
  onSelect,
  hideAmounts = false,
}: PricingSectionProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState<{
    x: number | null;
    y: number | null;
  }>({ x: null, y: null });

  // Check dark mode for DottedSurface
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = event;
    setMousePosition({ x: clientX, y: clientY });
  };

  return (
    <PricingContext.Provider value={{ isMonthly, setIsMonthly }}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMousePosition({ x: null, y: null })}
        className="relative w-full bg-transparent pt-16 pb-32 sm:pt-20 sm:pb-40 overflow-hidden"
      >
        <InteractiveStarfield
          mousePosition={mousePosition}
          containerRef={containerRef}
        />
        <div className="relative z-10 container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-20">
            <h2 className="text-4xl font-bold tracking-tighter sm:text-6xl text-navy-900 dark:text-white serif">
              {title}
            </h2>
            <p className="text-navy-500 dark:text-navy-400 text-lg whitespace-pre-line font-medium uppercase tracking-widest text-[10px]">
              {description}
            </p>
          </div>
          <PricingToggle />
          <div className="mt-24 md:mt-28 max-w-6xl mx-auto">
            <div
              className="
                flex md:grid md:grid-cols-3 items-stretch
                gap-6 md:gap-10
                overflow-x-auto md:overflow-visible
                snap-x snap-mandatory md:snap-none
                pb-4
                -mx-4 px-2 sm:px-4
              "
            >
              {plans.map((plan, index) => (
                <PricingCard key={index} plan={plan} index={index} onSelect={onSelect} hideAmounts={hideAmounts} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </PricingContext.Provider>
  );
}

// Pricing Toggle Component
function PricingToggle() {
  const { isMonthly, setIsMonthly } = useContext(PricingContext);
  const confettiRef = useRef<HTMLDivElement>(null);
  const monthlyBtnRef = useRef<HTMLButtonElement>(null);
  const annualBtnRef = useRef<HTMLButtonElement>(null);

  const [pillStyle, setPillStyle] = useState({});

  useEffect(() => {
    const btnRef = isMonthly ? monthlyBtnRef : annualBtnRef;
    if (btnRef.current) {
      setPillStyle({
        width: btnRef.current.offsetWidth,
        transform: `translateX(${btnRef.current.offsetLeft}px)`,
      });
    }
  }, [isMonthly]);

  const handleToggle = (monthly: boolean) => {
    if (isMonthly === monthly) return;
    setIsMonthly(monthly);

    if (!monthly && confettiRef.current) {
      const rect = annualBtnRef.current?.getBoundingClientRect();
      if (!rect) return;

      const originX = (rect.left + rect.width / 2) / window.innerWidth;
      const originY = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 80,
        spread: 80,
        origin: { x: originX, y: originY },
        colors: [
          "#0a0a0a",
          "#ffffff",
          "#6b6358",
        ],
        ticks: 300,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
      });
    }
  };

  return (
    <div className="flex justify-center">
      <div ref={confettiRef} className="relative flex w-fit items-center rounded-full bg-navy-50 dark:bg-navy-900/50 p-1 border border-navy-100 dark:border-navy-800">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full bg-navy-900 dark:bg-white"
          style={pillStyle}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
        <button
          ref={monthlyBtnRef}
          onClick={() => handleToggle(true)}
          className={cn(
            "relative z-10 rounded-full px-6 sm:px-8 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
            isMonthly
              ? "text-white dark:text-navy-950"
              : "text-navy-400 hover:text-navy-900 dark:hover:text-white",
          )}
        >
          Monthly
        </button>
        <button
          ref={annualBtnRef}
          onClick={() => handleToggle(false)}
          className={cn(
            "relative z-10 rounded-full px-6 sm:px-8 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
            !isMonthly
              ? "text-white dark:text-navy-950"
              : "text-navy-400 hover:text-navy-900 dark:hover:text-white",
          )}
        >
          Annual
          <span
            className={cn(
              "hidden sm:inline ml-1",
              !isMonthly ? "opacity-80" : "",
            )}
          >
            (Save 20%)
          </span>
        </button>
      </div>
    </div>
  );
}

// Pricing Card Component
function PricingCard({ plan, index, onSelect, hideAmounts = false }: { plan: PricingPlan; index: number; onSelect: (id: string) => void; hideAmounts?: boolean; key?: React.Key }) {
  const { isMonthly } = useContext(PricingContext);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [showSetupInfo, setShowSetupInfo] = useState(false);

  return (
    <motion.div
      initial={{ y: plan.isPopular && isDesktop ? -20 : 0, opacity: 1 }}
      animate={{ y: plan.isPopular && isDesktop ? -20 : 0, opacity: 1 }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "snap-center shrink-0 w-[78vw] sm:w-[68vw] md:w-auto md:shrink rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 flex flex-col relative bg-white/80 dark:bg-navy-950/80 backdrop-blur-md transition-all hover:shadow-2xl",
        plan.isPopular
          ? "border-2 border-navy-900 dark:border-white shadow-xl scale-105 z-10"
          : "border border-navy-100 dark:border-navy-800",
      )}
    >
      {plan.isPopular && (
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
          <div className="bg-navy-900 dark:bg-white py-2 px-6 rounded-full flex items-center gap-1.5 shadow-lg">
            <LucideStar className="text-white dark:text-navy-950 h-3 w-3 fill-current" />
            <span className="text-white dark:text-navy-950 text-[10px] font-bold uppercase tracking-widest">
              Most Popular
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col text-center">
        <h3 className="text-xl sm:text-2xl font-bold serif text-navy-900 dark:text-white">{plan.name}</h3>
        <p className="mt-3 text-xs sm:text-sm text-navy-500 dark:text-navy-400 font-medium">
          {plan.description}
        </p>
        {!hideAmounts ? (
          <>
            <div className="mt-6 md:mt-8 flex items-baseline justify-center gap-x-1">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-navy-900 dark:text-white">
                <NumberFlow
                  value={isMonthly ? plan.price : plan.yearlyPrice}
                  format={{
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }}
                  className="font-variant-numeric: tabular-nums serif"
                />
              </span>
              <span className="text-xs sm:text-sm font-bold leading-6 tracking-wide text-navy-300 uppercase">
                / {plan.period}
              </span>
            </div>
            <div className="mt-4 p-4 rounded-2xl bg-navy-50 dark:bg-navy-900/50 border border-navy-100 dark:border-navy-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-navy-400">
                {isMonthly ? "Monthly Breakdown" : "Annual Breakdown"}
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-navy-500 flex items-center gap-1">
                    <span>Once-off Setup</span>
                    <button
                      type="button"
                      onClick={() => setShowSetupInfo((prev) => !prev)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-navy-300/70 dark:border-navy-600/70 text-[8px] font-semibold text-navy-500 dark:text-navy-300 hover:text-navy-900 dark:hover:text-white hover:border-navy-500 dark:hover:border-white transition-colors"
                      aria-label="What the setup fee covers"
                    >
                      i
                    </button>
                  </span>
                  <span className="text-navy-900 dark:text-white">${plan.setupFee.toLocaleString()}</span>
                </div>
                {!isMonthly && (
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-navy-500">Annual Sub</span>
                    <span className="text-navy-900 dark:text-white">${(plan.yearlyPrice * 12).toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-navy-100 dark:border-navy-800 flex justify-between text-xs font-bold">
                  <span className="text-navy-900 dark:text-white">Due Today</span>
                  <span className="text-navy-900 dark:text-white">
                    ${(isMonthly ? (plan.setupFee + plan.price) : (plan.setupFee + plan.yearlyPrice * 12)).toLocaleString()}
                  </span>
                </div>
                {showSetupInfo && (
                  <p className="mt-3 text-[11px] leading-relaxed text-left text-navy-500 dark:text-navy-300">
                    Your setup fee is charged once per showroom. It covers call-flow design, safe-guarding, integrations
                    (including Nivoda, calendars, and CRM), test environment, iteration cycles, and the final handover to
                    your team.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 md:mt-8 p-4 rounded-2xl bg-navy-50 dark:bg-navy-900/50 border border-navy-100 dark:border-navy-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-navy-400">
              Private Pricing
            </p>
            <p className="mt-2 text-xs sm:text-sm text-navy-600 dark:text-navy-300 leading-relaxed">
              Every deployment is quoted custom for your call volume, locations and integrations. Choose a tier to configure
              your quote - no pricing appears until you&apos;re in the secure configurator.
            </p>
          </div>
        )}

        <ul
          role="list"
          className="mt-10 space-y-4 text-sm leading-6 text-left text-navy-600 dark:text-navy-200"
        >
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-x-3 items-center">
              <Check
                className="h-5 w-5 flex-none text-navy-900 dark:text-white"
                aria-hidden="true"
              />
              <span className="font-medium">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-10">
          <Button
            onClick={() => onSelect(plan.id)}
            variant={plan.isPopular ? "default" : "outline"}
            size="lg"
            className="w-full"
          >
            {plan.buttonText}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
