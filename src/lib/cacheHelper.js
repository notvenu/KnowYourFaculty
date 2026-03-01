/**
 * 🚀 Global Cache Helper
 * Provides localStorage-based caching for static/rarely-changing data
 * to reduce Firestore reads by ~90%
 */

class CacheHelper {
  constructor() {
    this.lsPrefix = "kyf_cache_";
    // Data that changes rarely should be cached longer (hours)
    this.STATIC_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    // Dynamic data can be cached for shorter periods (minutes)
    this.DYNAMIC_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Generate a cache key for localStorage
   */
  getCacheKey(namespace, id) {
    return `${this.lsPrefix}${namespace}:${id}`;
  }

  /**
   * Set a value in localStorage with expiry
   * @param {string} namespace - Cache namespace (e.g., 'faculty', 'courses')
   * @param {string} id - Item ID
   * @param {*} value - Value to cache
   * @param {number} ttlMs - Time to live in milliseconds (optional)
   */
  set(namespace, id, value, ttlMs = this.STATIC_CACHE_TTL_MS) {
    try {
      const key = this.getCacheKey(namespace, id);
      const data = {
        value,
        expiresAt: Date.now() + ttlMs,
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      // LocalStorage cache failed silently
    }
  }

  /**
   * Get a value from localStorage if not expired
   * @param {string} namespace - Cache namespace
   * @param {string} id - Item ID
   * @returns {* | null} - Cached value or null if expired/missing
   */
  get(namespace, id) {
    try {
      const key = this.getCacheKey(namespace, id);
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const data = JSON.parse(stored);
      if (!data || !data.expiresAt) return null;

      // Check expiry
      if (data.expiresAt <= Date.now()) {
        localStorage.removeItem(key);
        return null;
      }

      return data.value;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear cache for a namespace
   * @param {string} namespace - Cache namespace to clear
   */
  clear(namespace) {
    try {
      const prefix = this.getCacheKey(namespace, "");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      // LocalStorage clear failed silently
    }
  }

  /**
   * Clear all KYF cache
   */
  clearAll() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.lsPrefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      // LocalStorage clear all failed silently
    }
  }
}

export const cacheHelper = new CacheHelper();
export default cacheHelper;
