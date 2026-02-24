import { Children, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/ui";
import { PageHeader } from "@/components/ui/page-header";

interface MainProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
  headerClassName?: string;
}

export function Main({
  title,
  eyebrow,
  description,
  actions,
  children,
  className,
  maxWidthClassName = "max-w-6xl",
  headerClassName
}: MainProps) {
  const normalizedChildren = Children.toArray(children).filter(
    (child) => !(typeof child === "string" && child.trim().length === 0)
  );
  const firstChild = normalizedChildren[0];
  const firstElementIsMainMenu =
    isValidElement(firstChild) &&
    typeof firstChild.type !== "string" &&
    (firstChild.type.name === "MainMenu" ||
      (typeof firstChild.type === "function" &&
        "displayName" in firstChild.type &&
        firstChild.type.displayName === "MainMenu"));
  const beforeHeader = firstElementIsMainMenu ? firstChild : null;
  const contentChildren = firstElementIsMainMenu ? normalizedChildren.slice(1) : normalizedChildren;

  return (
    <main
      className={cn(
        "mx-auto min-h-screen px-6 pb-6 md:px-10 md:pb-10",
        maxWidthClassName,
        className
      )}
    >
      {beforeHeader}
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        className={headerClassName}
      />
      {contentChildren}
    </main>
  );
}
