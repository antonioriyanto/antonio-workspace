import { Store } from '../types';

export interface ResolvedStores {
  isAllStores: boolean;
  storeNames: string[];
  amList: string[];
  spvList: Array<{ store: string; spv: string }>;
  storesDetailed: Store[];
}

export function resolveStoresAndAmSpv(storeIds: string[], stores: Store[]): ResolvedStores {
  if (!storeIds || storeIds.length === 0 || storeIds.includes('ALL_STORES')) {
    return {
      isAllStores: true,
      storeNames: ['Semua Toko (HQ)'],
      amList: [],
      spvList: [],
      storesDetailed: []
    };
  }

  const matched = storeIds
    .map(id => stores.find(s => s.id === id))
    .filter((s): s is Store => Boolean(s));

  const amSet = new Set<string>();
  const spvList: Array<{ store: string; spv: string }> = [];

  matched.forEach(st => {
    if (st.am && st.am.trim() !== '') amSet.add(st.am.trim());
    if (st.spv && st.spv.trim() !== '') {
      spvList.push({ store: st.name, spv: st.spv.trim() });
    }
  });

  return {
    isAllStores: false,
    storeNames: matched.map(s => s.name),
    amList: Array.from(amSet),
    spvList,
    storesDetailed: matched
  };
}
