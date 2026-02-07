import React, { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SQRT_5000 = Math.sqrt(5000);

/* ---------------- MOCK DATA ---------------- */

const MOCK_TESTIMONIALS = [
  {
    id: 0,
    testimonial:
      "Naadiga waxa aan ku soo biiray 2024 kii, muddadaas aan ku jiray waxa uu ii noqday il aqooneed, oo runtii ogaalkay wax badan ku darsatay, maaddaama aan si bilaash Maktabaddiisa uga dhex helay buug haddii meel kale aan u raadsan lahaa qiima badan iigu kici lahayd.",
    by: "— Ciise Maxamed • Member",
    imgSrc: "/testomial/ciise.jpg",
  },
  {
    id: 1,
    testimonial:
      "Ku soo biiristii Naadigu waxa ay ii ahayd safar aqooneed iyo mid nafdhis. Waxa aan kula kulmay dad badan oo aan isku jiho u soconno, waxaa ku korodhay xirfaddayda dad la shaqaynta, waxaana ku kobcay aqoontayda guud.",
    by: "Nasra Maxamed • Member",
    imgSrc: "/testomial/nasra.jpg",
  },
  {
    id: 2,
    testimonial:
      "Ka mid ahaanshaha Naadigu waxa uu ii fududeeyay in aan si bilaash ah ku helo tababbarro iyo kulan-aqooneeddo xirfadahayga nololeed wax weyn ku darsaday.",
    by: "Kawsar Cabdikaafi • Member",
    imgSrc: "/testomial/kawsar.jpg",
  },
  {
    id: 3,
    testimonial:
      "Inkasta oo aan akhriska jeclaa haddana ma lahayn caado akhris ka hor inta aanan ku soo biirin Naadiga. Markii aan ku biiray waxaan yeeshay caado akhris sababtoo ah degaan akhris ayaa igu dhiirrigeliyay.",
    by: "Xasan Jeelle • Member",
    imgSrc: "/testomial/xasan.jpg",
  },
];

/* ---------------- HELPERS ---------------- */

function autoFontSize(len) {
  if (len > 400) return "text-sm";
  if (len > 250) return "text-base";
  return "text-lg";
}

/* ---------------- CARD ---------------- */

function TestimonialCard({ position, testimonial, handleMove, cardSize }) {
  const isCenter = position === 0;
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);

  const textSizeClass = autoFontSize(testimonial.testimonial.length);

  return (
    <div
      ref={cardRef}
      onClick={() => handleMove(position)}
      className={cn(
        "absolute mt-8 left-1/2 top-1/2 cursor-pointer border-2 p-8",
        "transition-all duration-500 ease-in-out overflow-hidden",
        isCenter
          ? "z-10 bg-primary text-primary-foreground border-primary"
          : "z-0 bg-card text-card-foreground border-border hover:border-primary/50"
      )}
      style={{
        width: cardSize,
        minHeight: cardSize,
        transform: `
          translate(-50%, -50%)
          translateX(${(cardSize / 1.5) * position}px)
          translateY(${isCenter ? -65 : position % 2 ? 15 : -15}px)
          rotate(${isCenter ? 0 : position % 2 ? 2.5 : -2.5}deg)
        `,
        clipPath:
          "polygon(50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, calc(100% - 50px) 100%, 50px 100%, 0 100%, 0 0)",
        boxShadow: isCenter
          ? "0px 8px 0px 4px hsl(var(--border))"
          : "none",
      }}
    >
      <span
        className="absolute block origin-top-right rotate-45 bg-border"
        style={{ right: -2, top: 48, width: SQRT_5000, height: 2 }}
      />

      <img
        src={testimonial.imgSrc}
        alt={testimonial.by}
        className="mb-4 h-16 w-12 rounded bg-muted object-cover"
        style={{ boxShadow: "3px 3px 0px hsl(var(--background))" }}
      />

      <h3
        className={cn(
          "font-medium transition-all duration-300",
          textSizeClass,
          !expanded && "line-clamp-4"
        )}
      >
        {testimonial.testimonial}
      </h3>

      {testimonial.testimonial.length > 150 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((prev) => !prev);
          }}
          className={cn(
            "mt-3 text-xs underline",
            isCenter ? "text-primary-foreground/80" : "text-primary"
          )}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}

      <p
        className={cn(
          "mt-4 text-sm italic",
          isCenter
            ? "text-primary-foreground/80"
            : "text-muted-foreground"
        )}
      >
        {testimonial.by}
      </p>
    </div>
  );
}

/* ---------------- MAIN COMPONENT ---------------- */

export default function StaggerTestimonials({
  testimonials,
  className,
  title = "What Members Are Saying",
  description =
    "Short stories from our reading club — borrow books, join discussions, and stay motivated together.",
}) {
  const [cardSize, setCardSize] = useState(365);
  const [list, setList] = useState([]);

  /* sync props safely (fix duplication issue) */
  useEffect(() => {
    if (Array.isArray(testimonials) && testimonials.length) {
      setList(testimonials);
    } else {
      setList(MOCK_TESTIMONIALS);
    }
  }, [testimonials]);

  /* responsive card size */
  useEffect(() => {
    const updateSize = () => {
      const { matches } = window.matchMedia("(min-width: 640px)");
      setCardSize(matches ? 365 : 290);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  /* carousel move */
  const handleMove = (steps) => {
    const newList = [...list];

    if (steps > 0) {
      for (let i = 0; i < steps; i++) {
        newList.push(newList.shift());
      }
    } else {
      for (let i = 0; i < Math.abs(steps); i++) {
        newList.unshift(newList.pop());
      }
    }

    setList([...newList]);
  };

  return (
    <section className={cn("w-full", className)} id="testimonials">
      <div className="mx-auto max-w-4xl px-6 pt-16 text-center">
        <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          {description}
        </p>
      </div>

      <div
        className="relative w-full overflow-hidden bg-muted/30"
        style={{ minHeight: 700 }}
      >
        {list.map((testimonial, index) => {
          const position =
            list.length % 2
              ? index - (list.length + 1) / 2
              : index - list.length / 2;

          return (
            <TestimonialCard
              key={testimonial.id}
              testimonial={testimonial}
              handleMove={handleMove}
              position={position}
              cardSize={cardSize}
            />
          );
        })}

        <div className="absolute mt-12 bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          <button
            onClick={() => handleMove(-1)}
            className="flex h-14 w-14 items-center justify-center border-2 bg-background hover:bg-primary hover:text-primary-foreground"
            type="button"
          >
            <ChevronLeft />
          </button>

          <button
            onClick={() => handleMove(1)}
            className="flex h-14 w-14 items-center justify-center border-2 bg-background hover:bg-primary hover:text-primary-foreground"
            type="button"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
}
