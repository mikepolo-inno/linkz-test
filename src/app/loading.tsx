export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
        Loading seats...
      </div>
    </div>
  );
}
