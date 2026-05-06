import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";

type ToastMessage<TData, TVariables> =
  | string
  | ((data: TData, variables: TVariables) => string);

type ToastErrorMessage<TError, TVariables> =
  | string
  | ((error: TError, variables: TVariables) => string);

interface ToastMessages {
  loading?: string;
}

interface ToastMessagesFor<TData, TError, TVariables> extends ToastMessages {
  success: ToastMessage<TData, TVariables>;
  error?: ToastErrorMessage<TError, TVariables>;
}

export function withToast<TData, TError, TVariables>(
  mutation: Pick<UseMutationResult<TData, TError, TVariables>, "mutateAsync">,
  messages: ToastMessagesFor<TData, TError, TVariables>,
) {
  return (variables: TVariables) => {
    const promise = mutation.mutateAsync(variables);
    const formatSuccess = (data: TData) => {
      if (typeof messages.success === "function")
        return messages.success(data, variables);
      return messages.success;
    };
    const formatError = (err: unknown) => {
      if (typeof messages.error === "function")
        return messages.error(err as TError, variables);
      if (messages.error) return messages.error;
      if (err instanceof Error) return err.message;
      return "Something went wrong. See logs.";
    };

    toast.promise(promise, {
      loading: messages.loading ?? "Loading…",
      success: formatSuccess,
      error: formatError,
    });
    return promise;
  };
}
