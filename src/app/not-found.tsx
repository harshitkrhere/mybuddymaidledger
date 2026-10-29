import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This record or page does not exist. It may have been deleted.
        </p>
      </div>
      <Button asChild className="rounded-full px-5">
        <Link href="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
