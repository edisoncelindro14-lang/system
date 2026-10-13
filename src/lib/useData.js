import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { getSessionMemberId } from "./auth";

// Last result per query, so revisiting a page shows data instantly while it refreshes silently.
// Persisted in sessionStorage so a full page refresh also renders instantly from the last result.
const CACHE_KEY = "mlm_data_cache";
let initial = [];
try { initial = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "[]"); } catch { /* ignore */ }
const cache = new Map(initial);
let persistTimer = null;
function persistCache() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify([...cache])); } catch { /* quota: skip */ }
  }, 300);
}
const setCache = (key, value) => { cache.set(key, value); persistCache(); };
export const clearDataCache = () => { cache.clear(); try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ } };

// Warm the cache for unfiltered tables (e.g. right after login) so the next page renders instantly.
export function prefetchTables(names) {
  names.forEach(async (name) => {
    const { data, error } = await supabase.from(name).select("*");
    if (!error) setCache(`${name}|null|null|null`, data || []);
  });
}

// Generic data fetcher hook (replaces React Query for simplicity)
export function useTable(tableName, options = {}) {
  const { filter = null, order = null, limit = null, enabled = true } = options;
  const cacheKey = `${tableName}|${JSON.stringify(filter)}|${order}|${limit}`;
  const cached = cache.get(cacheKey);
  const [data, setData] = useState(cached ?? []);
  const [isLoading, setIsLoading] = useState(enabled && !cached);
  const loadedOnce = useRef(!!cached);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    if (!loadedOnce.current) setIsLoading(true); // background refetches stay silent
    try {
      let query = supabase.from(tableName).select("*");
      if (filter) {
        for (const [key, value] of Object.entries(filter)) {
          if (key === "$in" && Array.isArray(value)) {
            // Handle $in filter
            for (const [k, v] of Object.entries(value)) {
              query = query.in(k, v);
            }
          } else {
            query = query.eq(key, value);
          }
        }
      }
      if (order) {
        const [col, dir] = order.startsWith("-") ? [order.slice(1), false] : [order, true];
        query = query.order(col, { ascending: dir });
      }
      if (limit) query = query.limit(limit);
      const { data: result, error } = await query;
      if (!error) { setCache(cacheKey, result || []); setData(result || []); loadedOnce.current = true; }
    } catch (e) {
      console.error(`Error fetching ${tableName}:`, e);
    }
    setIsLoading(false);
  }, [cacheKey, tableName, JSON.stringify(filter), order, limit, enabled]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, isLoading, refetch: fetchData };
}

// Hook to get the current logged-in member
export function useCurrentMember(members = []) {
  const [currentMember, setCurrentMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getSessionMemberId();
    if (id && members.length > 0) {
      const found = members.find(m => m.id === id);
      if (found) {
        setCurrentMember(found);
        setLoading(false);
        return;
      }
    }
    if (members.length === 0) return;
    setLoading(false);
  }, [members]);

  return { currentMember, loading };
}

// Mutation helper
export async function createRecord(tableName, data) {
  return supabase.from(tableName).insert(data).select().single();
}

export async function updateRecord(tableName, id, data) {
  return supabase.from(tableName).update(data).eq("id", id).select().single();
}

export async function deleteRecord(tableName, id) {
  return supabase.from(tableName).delete().eq("id", id);
}
