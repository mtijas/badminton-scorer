import { type ReactElement } from "react";

interface RequestErrorProps {
  readonly message: string;
}

export function RequestError({ message }: RequestErrorProps): ReactElement {
  return (
    <p className="request-error" role="alert">
      {message}
    </p>
  );
}
