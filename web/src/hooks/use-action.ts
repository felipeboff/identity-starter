import { useState } from "preact/hooks";

import { useToast } from "../ui/toast";

export type Action = {
  run: () => Promise<void>;
  pending: boolean;
};

export const useAction = (perform: () => Promise<void>): Action => {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      await perform();
    } catch (error) {
      toast.error(error);
    } finally {
      setPending(false);
    }
  };

  return { run, pending };
};
