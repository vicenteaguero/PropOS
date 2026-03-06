import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@features/projects/services/projects-api";
import type { Project } from "@features/projects/types";

const PROJECTS_QUERY_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery<Project[], Error>({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const result = await fetchProjects();
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}
