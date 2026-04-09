"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionItemProps {
  title: string
  icon?: React.ReactNode
  description?: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
}

export function AccordionItem({
  title,
  icon,
  description,
  isExpanded,
  onToggle,
  children,
  className
}: AccordionItemProps) {
  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-card", className)}>
      {/* Accordion Header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer text-left",
          isExpanded && "bg-primary/5"
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="flex flex-col min-w-0">
            <span className={cn("text-sm font-medium", isExpanded && "text-primary")}>{title}</span>
            {description && !isExpanded && (
              <span className="text-xs text-muted-foreground truncate">{description}</span>
            )}
          </div>
        </div>
        <span className="shrink-0 ml-2">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Accordion Content */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          !isExpanded && "max-h-0 opacity-0",
          isExpanded && "max-h-[500px] opacity-100"
        )}
      >
        <div className="p-4 border-t border-border">
          {children}
        </div>
      </div>
    </div>
  )
}
