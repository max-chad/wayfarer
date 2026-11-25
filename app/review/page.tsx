import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import { ReviewPicker } from "@/components/review/ReviewPicker";

export const metadata: Metadata = { title: "Write a review" };

export default function ReviewStartPage() {
  return (
    <div className="container-page max-w-2xl pt-16 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <PenLine className="size-6" />
      </div>
      <h1 className="mt-5 font-display text-4xl font-semibold">What would you like to review?</h1>
      <p className="mt-2 text-muted">Honest, specific reviews help millions of travelers decide. Our AI assistant can help you write yours.</p>
      <div className="mt-8 text-left">
        <ReviewPicker />
      </div>
    </div>
  );
}
