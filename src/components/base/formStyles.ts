export const inputClass = (hasError = false): string =>
  `w-full rounded-lg border bg-background-50 px-3 py-2.5 text-sm text-foreground-800 placeholder:text-foreground-400 focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-accent-400 focus:border-accent-400 focus:ring-accent-100'
      : 'border-background-200 focus:border-primary-400 focus:ring-primary-100'
  }`;