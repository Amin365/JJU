import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SQRT_5000 = Math.sqrt(5000);

// Reading-club mock data (you can replace later)
const MOCK_TESTIMONIALS = [
  {
    tempId: 0,
    testimonial:
      "Borrowing books through the club made reading affordable, and the recommendations are always on point.",
    by: "Amina • Member",
    imgSrc: "https://i.pravatar.cc/150?img=1",
  },
  {
    tempId: 1,
    testimonial:
      "The weekly discussions helped me understand books deeper. I actually look forward to finishing chapters now.",
    by: "Omar • Weekly Discussions",
    imgSrc: "https://i.pravatar.cc/150?img=2",
  },
  {
    tempId: 2,
    testimonial:
      "Reading challenges made me consistent. Tracking progress with the club motivates me to keep going.",
    by: "Sara • Reading Challenges",
    imgSrc: "https://i.pravatar.cc/150?img=3",
  },
  {
    tempId: 3,
    testimonial:
      "I met friends who love the same genres. The community is supportive and always encourages new readers.",
    by: "Youssef • Community Member",
    imgSrc: "https://i.pravatar.cc/150?img=4",
  },
 
];

function TestimonialCard({ position, testimonial, handleMove, cardSize }) {
  const isCenter = position === 0;

  return (
    <div
      onClick={() => handleMove(position)}
      className={cn(
        "absolute mt-8 left-1/2 top-1/2 cursor-pointer border-2 p-8 transition-all duration-500 ease-in-out",
        isCenter
          ? "z-10 bg-primary text-primary-foreground border-primary"
          : "z-0 bg-card text-card-foreground border-border hover:border-primary/50"
      )}
      style={{
        width: cardSize,
        height: cardSize,
        clipPath: `polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)`,
        transform: `
          translate(-50%, -50%)
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        boxShadow: isCenter
          ? "0px 8px 0px 4px hsl(var(--border))"
          : "0px 0px 0px 0px transparent",
      }}
    >
      <span
        className="absolute block origin-top-right rotate-45 bg-border"
        style={{
          right: -2,
          top: 48,
          width: SQRT_5000,
          height: 2,
        }}
      />

      <img
        src={testimonial.imgSrc}
        alt={testimonial.by?.split("•")?.[0]?.trim() || "Member"}
        className="mb-4 h-14 w-12 bg-muted object-cover object-top"
        style={{
          boxShadow: "3px 3px 0px hsl(var(--background))",
        }}
      />

      <h3
        className={cn(
          "text-base sm:text-xl font-medium",
          isCenter ? "text-primary-foreground" : "text-foreground"
        )}
      >
        "{testimonial.testimonial}"
      </h3>

      <p
        className={cn(
          "absolute bottom-8 left-8 right-8 mt-2 text-sm italic",
          isCenter ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        - {testimonial.by}
      </p>
    </div>
  );
}

const StaggerTestimonials = ({
  testimonials,
  className,
  title = "What Members Are Saying",
  description = "Short stories from our reading club—borrow books, join discussions, and stay motivated together.",
}) => {
  const [cardSize, setCardSize] = useState(365);
  const [testimonialsList, setTestimonialsList] = useState(
    Array.isArray(testimonials) && testimonials.length ? testimonials : MOCK_TESTIMONIALS
  );

  const handleMove = (steps) => {
    const newList = [...testimonialsList];

    if (steps > 0) {
      for (let i = steps; i > 0; i--) {
        const item = newList.shift();
        if (!item) return;
        newList.push({ ...item, tempId: Math.random() });
      }
    } else {
      for (let i = steps; i < 0; i++) {
        const item = newList.pop();
        if (!item) return;
        newList.unshift({ ...item, tempId: Math.random() });
      }
    }

    setTestimonialsList(newList);
  };

  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia("(min-width: 640px)");
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <section className={cn("w-full", className)}>
      {/* Header + paragraph */}
      <div className="mx-auto max-w-4xl px-6 pt-16 text-center">
        <h2 className="text-balance text-3xl font-semibold text-foreground md:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      </div>

      {/* Testimonials */}
      <div className="relative w-full overflow-hidden bg-muted/30" style={{ height: 600 }}>
        {testimonialsList.map((testimonial, index) => {
          const position =
            testimonialsList.length % 2
              ? index - (testimonialsList.length + 1) / 2
              : index - testimonialsList.length / 2;

          return (
            <TestimonialCard
              key={testimonial.tempId}
              testimonial={testimonial}
              handleMove={handleMove}
              position={position}
              cardSize={cardSize}
            />
          );
        })}

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          <button
            onClick={() => handleMove(-1)}
            className={cn(
              "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
              "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label="Previous testimonial"
            type="button"
          >
            <ChevronLeft />
          </button>

          <button
            onClick={() => handleMove(1)}
            className={cn(
              "flex h-14 w-14 items-center justify-center text-2xl transition-colors",
              "bg-background border-2 border-border hover:bg-primary hover:text-primary-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label="Next testimonial"
            type="button"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
};

export default StaggerTestimonials;