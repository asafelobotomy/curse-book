import { createContext, useContext, type ReactNode } from "react";
import { registrySourceIds } from "./tags";

const CatalogRegistrySourceContext = createContext<string[]>(
  registrySourceIds(),
);

export function CatalogRegistrySourceProvider({
  sourceIds,
  children,
}: {
  sourceIds: string[];
  children: ReactNode;
}) {
  return (
    <CatalogRegistrySourceContext.Provider value={registrySourceIds(sourceIds)}>
      {children}
    </CatalogRegistrySourceContext.Provider>
  );
}

export function useRegistrySourceIds(): string[] {
  return useContext(CatalogRegistrySourceContext);
}
