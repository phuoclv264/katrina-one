import React from "react";
import { Loader2 } from "lucide-react";

export function LoadingPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang tải dữ liệu...</p>
        </div>
      </div>
    </div>
  );
}
