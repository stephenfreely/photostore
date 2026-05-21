import { useQuery } from "@tanstack/react-query";
import { fetchHello, healthKeys } from "../api/health";

export function useHello() {
  return useQuery({
    queryKey: healthKeys.hello,
    queryFn: fetchHello,
  });
}
