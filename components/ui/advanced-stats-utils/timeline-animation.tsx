"use client";

import React from "react";
import { motion, useInView } from "motion/react";

interface TimelineAnimationProps {
  animationNum: number;
  timelineRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children: React.ReactNode;
}

export const TimelineAnimation: React.FC<TimelineAnimationProps> = ({
  animationNum,
  timelineRef,
  className,
  children,
}) => {
  const internalRef = React.useRef<HTMLDivElement>(null);
  const targetRef = timelineRef || internalRef;
  const isInView = useInView(targetRef, {
    once: true,
    margin: "-40px 0px",
  });

  return (
    <motion.div
      ref={internalRef}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.98 }}
      transition={{
        duration: 0.5,
        delay: Math.max(0, (animationNum - 1) * 0.1),
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
