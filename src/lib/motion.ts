import type { Transition, Variants } from "framer-motion";

/** The house spring — snappy, barely any overshoot. */
export const spring: Transition = { type: "spring", stiffness: 300, damping: 25 };
export const springFirm: Transition = { type: "spring", stiffness: 420, damping: 32 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring },
};

export const stagger = (step = 0.04, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

export const popoverMotion = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.12 } },
};
