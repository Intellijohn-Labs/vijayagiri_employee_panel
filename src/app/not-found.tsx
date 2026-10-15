import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-sm text-center">
      <p className="font-mono text-xs text-faint">404</p>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-fg">This page took a wrong turn</h1>
      <p className="mt-1.5 text-[13px] text-muted">The page you&apos;re looking for doesn&apos;t exist in the Ops Hub.</p>
      <Link href="/branches" className="mt-5 inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover">
        Back to branches
      </Link>
    </div>
  );
}
