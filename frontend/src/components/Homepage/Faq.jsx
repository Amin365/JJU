import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// shadcn/ui Accordion (shadcn wraps Radix, but you use shadcn components)
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * React JS + shadcn/ui version:
 * - Uses shadcn Accordion components (instead of direct Radix import)
 * - No TypeScript
 * - No "use client"
 * - Keeps GSAP ScrollTrigger + framer-motion animations
 */
export default function ScrollFAQAccordion({
  data = [
    {
      id: 1,
      question: "How do I join the Reading Club?",
      answer:
        "Create an account, complete your profile, and you can start joining activities and discussions immediately.",
    },
    {
      id: 2,
      question: "Can I borrow books from the club?",
      answer:
        "Yes. Members can request books from the club library (or other members) based on availability and borrowing rules.",
    },
    {
      id: 3,
      question: "How often do you meet?",
      answer:
        "We usually host weekly sessions and monthly themed events. Check the Events page for the latest schedule.",
    },
    {
      id: 4,
      question: "Do I need to finish the book to join discussions?",
      answer:
        "Not required. You can join at any point—many sessions include summaries and spoiler-friendly segments.",
    },
    {
      id: 5,
      question: "Is the club free?",
      answer:
        "Basic membership is free. Some special events or workshops may require registration or limited seats.",
    },
  ],
  className,
  questionClassName,
  answerClassName,
  title = "Frequently Asked Questions",
  description = "Find quick answers about membership, borrowing books, events, and how our reading club works.",
}) {
  const [openItem, setOpenItem] = useState("");

  const containerRef = useRef(null);
  const contentRefs = useRef(new Map());

  return (
    <div
      ref={containerRef}
      className={cn("max-w-4xl mt-12 mx-auto text-center py-16 ", className)}
    >
      <h2 className="text-3xl font-bold mb-2 text-foreground">{title}</h2>
      <p className="text-gray-600 dark:text-gray-200 mb-6">{description}</p>

      <Accordion
        type="single"
        collapsible
        value={openItem}
        onValueChange={(v) => setOpenItem(v || "")}
      >
        {data.map((item) => {
          const key = String(item.id);
          const isOpen = openItem === key;

          return (
            <AccordionItem value={key} key={key} className="mb-6 border-b-0">
              {/* Custom trigger UI (keeps your design) */}
              <AccordionTrigger className="flex w-full items-center justify-start gap-x-4 cursor-default [&>svg]:hidden">
                <div
                  className={cn(
                    "relative flex items-center space-x-2 rounded-xl p-2 transition-colors",
                    isOpen ? "bg-primary/20 text-primary" : "bg-muted",
                    questionClassName
                  )}
                >
                  {item.icon && (
                    <span
                      className={cn(
                        "absolute bottom-6",
                        item.iconPosition === "right" ? "right-0" : "left-0"
                      )}
                      style={{
                        transform:
                          item.iconPosition === "right"
                            ? "rotate(7deg)"
                            : "rotate(-4deg)",
                      }}
                    >
                      {item.icon}
                    </span>
                  )}

                  <span className="font-medium">{item.question}</span>
                </div>

                <span
                  className={cn(
                    "text-gray-600 dark:text-gray-200",
                    isOpen && "text-primary"
                  )}
                >
                  {isOpen ? (
                    <Minus className="h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </span>
              </AccordionTrigger>

              {/* Use shadcn content wrapper but animate inner content with framer-motion */}
              <AccordionContent asChild forceMount>
                <motion.div
                  ref={(el) => {
                    if (el) contentRefs.current.set(key, el);
                  }}
                  initial="collapsed"
                  animate={isOpen ? "open" : "collapsed"}
                  variants={{
                    open: { opacity: 1, height: "auto" },
                    collapsed: { opacity: 0, height: 0 },
                  }}
                  transition={{ duration: 0.4 }}
                  className="overflow-hidden"
                >
                  <div className="flex justify-end ml-7 mt-4 md:ml-16">
                    <div
                      className={cn(
                        "relative max-w-md rounded-2xl px-4 py-2 text-white dark:text-black text-lg !bg-blue-400 dark:!bg-blue-600",
                        answerClassName
                      )}
                    >
                      {item.answer}
                    </div>
                  </div>
                </motion.div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}