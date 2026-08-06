/** 路由级加载占位。 */

import { Loader2 } from 'lucide-react';

export function PageLoading() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      加载中…
    </div>
  );
}
