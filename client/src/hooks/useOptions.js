import { useEffect, useState } from 'react';
import { metaApi } from '../services/resources.js';
import { FALLBACK_OPTIONS } from '../utils/constants.js';

// Cached module-level: the option lists are small, static and shared by every form.
let cache = null;
let inFlight = null;

/**
 * Enum options (project types, departments, priorities…) served by the API, so a new
 * option added on the server appears in every dropdown without a frontend change.
 */
export const useOptions = () => {
  const [options, setOptions] = useState(cache || FALLBACK_OPTIONS);

  useEffect(() => {
    if (cache) return undefined;
    let cancelled = false;

    inFlight = inFlight || metaApi.options();
    inFlight
      .then((response) => {
        cache = { ...FALLBACK_OPTIONS, ...response.data };
        if (!cancelled) setOptions(cache);
      })
      .catch(() => {
        // Keep the built-in lists; they match the server's defaults.
      })
      .finally(() => {
        inFlight = null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};
