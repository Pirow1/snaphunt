import { useEffect, useState } from 'react';
import { requestCompassPermission, subscribeCompass } from '../lib/compass';

export type UseCompassResult = {
  heading: number | null;
  requestPerm: () => Promise<boolean>;
};

export function useCompass(): UseCompassResult {
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => subscribeCompass(setHeading), []);
  return { heading, requestPerm: requestCompassPermission };
}
