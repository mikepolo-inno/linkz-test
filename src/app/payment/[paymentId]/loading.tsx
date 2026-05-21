import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <main className="mx-auto grid w-full max-w-xl gap-6">
      <Card>
        <div className="h-3 w-24 animate-pulse-soft rounded-full bg-muted" />
        <div className="mt-4 h-9 w-64 animate-pulse-soft rounded-xl bg-muted" />
        <div className="mt-3 h-4 w-full animate-pulse-soft rounded-md bg-muted" />
        <div className="mt-1 h-4 w-3/4 animate-pulse-soft rounded-md bg-muted" />
        <div className="mt-6 h-32 animate-pulse-soft rounded-2xl bg-muted" />
      </Card>
    </main>
  );
}
