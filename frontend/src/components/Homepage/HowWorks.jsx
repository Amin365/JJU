import React, { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { AnimatedBeam } from "../ui/animated-beam";

const Circle = forwardRef(function Circle({ className, children }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "z-10 flex size-12 items-center justify-center rounded-full border-2 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {children}
    </div>
  );
});

function StepIcon({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-2" id="how-it-works">
      {icon}
      <div className="text-center leading-tight">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>
    </div>
  );
}

export function AnimatedBeamDemo({ clubLogoSrc }) {
  const containerRef = useRef(null);

  const registerRef = useRef(null);
  const activitiesRef = useRef(null);
  const progressRef = useRef(null);
  const growRef = useRef(null);
  const centerRef = useRef(null);

  return (
    <div className="w-full mt-12">
      {/* Header */}
    <div className="mb-8 text-center ">
  <h2 className="text-3xl font-bold text-gray-900">
    How Our Club System Works
  </h2>
  <p className="mt-1 text-sm text-gray-600">
    A simple and modern process that helps members connect, participate, and grow together.
  </p>
</div>

      <div
        className="relative flex h-[360px] w-full items-center justify-center overflow-hidden px-6 mt-6"
        ref={containerRef}
      >
        <div className="flex size-full max-w-3xl flex-col items-stretch justify-between gap-10">
          {/* Top row */}
          <div className="flex flex-row items-start justify-between">
            <div ref={registerRef} className="flex flex-col items-center">
              <StepIcon
                icon={
                  <Circle>
                    <Icons.register />
                  </Circle>
                }
                title="Register"
                subtitle="Create your member account"
              />
            </div>

            <div ref={growRef} className="flex flex-col items-center">
              <StepIcon
                icon={
                  <Circle>
                    <Icons.grow />
                  </Circle>
                }
                title="Grow Together"
                subtitle="Build skills and connections"
              />
            </div>
          </div>

          {/* Center row */}
          <div className="flex flex-row items-center justify-center">
            <div ref={centerRef} className="flex flex-col items-center">
              <Circle className="size-16">
                {clubLogoSrc ? (
                  <img
                    src={clubLogoSrc}
                    alt="Club logo"
                    className="w-10 h-10 object-contain rounded-lg"
                  />
                ) : (
                  <Icons.clubLogo className="w-10 h-10 rounded-lg " />
                )}
              </Circle>
              <p className="mt-2 text-sm font-semibold text-gray-900">Our Club</p>
              <p className="text-xs text-gray-600">Community hub</p>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex flex-row items-start justify-between">
            <div ref={activitiesRef} className="flex flex-col items-center">
              <StepIcon
                icon={
                  <Circle>
                    <Icons.activities />
                  </Circle>
                }
                title="Join Activities"
                subtitle="Participate in club events"
              />
            </div>

            <div ref={progressRef} className="flex flex-col items-center">
              <StepIcon
                icon={
                  <Circle>
                    <Icons.progress />
                  </Circle>
                }
                title="Track Progress"
                subtitle="View your involvement"
              />
            </div>
          </div>
        </div>

        {/* Beams to center */}
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={registerRef}
          toRef={centerRef}
          curvature={-75}
          endYOffset={-10}
        />
        <AnimatedBeam containerRef={containerRef} fromRef={activitiesRef} toRef={centerRef} />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={progressRef}
          toRef={centerRef}
          curvature={75}
          endYOffset={10}
        />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={growRef}
          toRef={centerRef}
          curvature={-75}
          endYOffset={-10}
          reverse
        />
      </div>
    </div>
  );
}

const Icons = {
  // Replace later with your real club logo (SVG or <img />)
  clubLogo: () => (
    <svg
      width="100"
      height="100"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Club logo"
    >
      <path d="M12 2 20 6v6c0 5-3.2 9.4-8 10-4.8-.6-8-5-8-10V6l8-4z" />
      <path d="M8 10h8v2H8z" />
    </svg>
  ),

  register: () => (
    <svg viewBox="0 0 24 24" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2-8 4v2h16v-2c0-2-3.58-4-8-4z" />
    </svg>
  ),

  activities: () => (
    <svg viewBox="0 0 24 24" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2v8h8a8 8 0 0 0-8-8zM11 2a10 10 0 1 0 10 10h-10z" />
    </svg>
  ),

  progress: () => (
    <svg viewBox="0 0 24 24" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 19h16v2H4zM6 17V7h2v10zm5 0V3h2v14zm5 0V11h2v6z" />
    </svg>
  ),

  grow: () => (
    <svg viewBox="0 0 24 24" width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2l4 7h-3v6h-2V9H8l4-7zm-7 18h14v2H5z" />
    </svg>
  ),
};