import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BUILTIN_CATEGORIES,
  type CategoryDef,
  type IoniconsName,
} from "@/constants/icons";

interface CategoriesContextType {
  categories: CategoryDef[];
  customCategories: CategoryDef[];
  loading: boolean;
  addCategory: (input: { label: string; name: IoniconsName }) => Promise<CategoryDef>;
  deleteCategory: (id: string) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);
const CATEGORIES_KEY = "@lifelens:customCategories";

function generateId(): string {
  return "cat:" + Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [customCategories, setCustomCategories] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CATEGORIES_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as CategoryDef[];
          if (Array.isArray(parsed)) {
            setCustomCategories(parsed.filter((c) => !c.builtIn));
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (next: CategoryDef[]) => {
    setCustomCategories(next);
    try {
      await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    } catch {
      // ignore persistence errors
    }
  }, []);

  const addCategory = useCallback(
    async ({ label, name }: { label: string; name: IoniconsName }) => {
      const cat: CategoryDef = {
        id: generateId(),
        name,
        label: label.trim().slice(0, 20) || "Custom",
        builtIn: false,
      };
      await persist([...customCategories, cat]);
      return cat;
    },
    [customCategories, persist]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const next = customCategories.filter((c) => c.id !== id);
      await persist(next);
    },
    [customCategories, persist]
  );

  const categories = useMemo(
    () => [...BUILTIN_CATEGORIES, ...customCategories],
    [customCategories]
  );

  return (
    <CategoriesContext.Provider
      value={{ categories, customCategories, loading, addCategory, deleteCategory }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside CategoriesProvider");
  return ctx;
}
