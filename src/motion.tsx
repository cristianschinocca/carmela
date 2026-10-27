import { useState, type PropsWithChildren } from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  type Transition,
  type Variants,
} from "motion/react";

export const motionTokens = {
  duration: { instant: 0.14, fast: 0.18, base: 0.24, slow: 0.3 },
  ease: {
    standard: [0.22, 1, 0.36, 1] as const,
    enter: [0.16, 1, 0.3, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
};

export const transitions = {
  fast: {
    duration: motionTokens.duration.fast,
    ease: motionTokens.ease.standard,
  },
  base: {
    duration: motionTokens.duration.base,
    ease: motionTokens.ease.standard,
  },
  enter: {
    duration: motionTokens.duration.base,
    ease: motionTokens.ease.enter,
  },
  exit: {
    duration: motionTokens.duration.instant,
    ease: motionTokens.ease.exit,
  },
} satisfies Record<string, Transition>;

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: transitions.enter },
  exit: { opacity: 0, y: -4, transition: transitions.exit },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: transitions.enter },
  exit: { opacity: 0, y: 5, transition: transitions.exit },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.fast },
  exit: { opacity: 0, transition: transitions.exit },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transitions.enter },
  exit: { opacity: 0, scale: 0.985, y: 8, transition: transitions.exit },
};

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: transitions.enter },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: transitions.exit },
};

export const press = { scale: 0.98 };
export const subtleHover = { y: -2 };

export function MotionProvider({ children }: PropsWithChildren) {
  return (
    <MotionConfig reducedMotion="user" transition={transitions.base}>
      {children}
    </MotionConfig>
  );
}

export function AnimatedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <AnimatePresence>
        {!loaded && (
          <motion.span
            className="image-skeleton"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <motion.img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        initial={{ opacity: 0, scale: 1.015 }}
        animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 1.015 }}
        transition={transitions.base}
      />
    </>
  );
}
