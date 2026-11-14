interface FormErrorProps {
  message: string | null;
}

export default function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <div className="rounded-lg border border-accent-200 bg-accent-100/60 p-3 text-sm text-accent-800">
      <div className="flex items-start gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <i className="ri-error-warning-line"></i>
        </span>
        <p>{message}</p>
      </div>
    </div>
  );
}