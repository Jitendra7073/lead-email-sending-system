/**
 * Variable Info Component
 * Displays an info button with hover tooltips explaining each variable
 */

"use client"

import * as React from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { TEMPLATE_VARIABLES } from "@/lib/template-variables"

export function VariableInfo({ className }: { className?: string }) {
  const [hoveredVariable, setHoveredVariable] = React.useState<string | null>(null)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = (key: string) => {
    timeoutRef.current = setTimeout(() => {
      setHoveredVariable(key)
    }, 300)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setHoveredVariable(null)
  }

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <Info className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Available Variables</span>
        <span className="text-xs text-muted-foreground">
          Type <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">@</kbd> to insert
        </span>
      </div>

      {/* Variables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TEMPLATE_VARIABLES.map((variable) => (
          <VariableCard
            key={variable.key}
            variable={variable}
            isHovered={hoveredVariable === variable.key}
            onMouseEnter={() => handleMouseEnter(variable.key)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </div>

      {/* Detailed Info Panel */}
      {hoveredVariable && (
        <VariableDetailPanel
          variable={TEMPLATE_VARIABLES.find(v => v.key === hoveredVariable)!}
          onClose={() => setHoveredVariable(null)}
        />
      )}
    </div>
  )
}

function VariableCard({
  variable,
  isHovered,
  onMouseEnter,
  onMouseLeave
}: {
  variable: (typeof TEMPLATE_VARIABLES)[0]
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg border transition-all cursor-help",
        isHovered
          ? "bg-primary/10 border-primary/30"
          : "bg-card/50 border-border/60 hover:bg-accent/50"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="text-xl flex-shrink-0">{variable.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{variable.label}</span>
          <kbd className="text-[10px] px-1 py-0.5 bg-muted rounded font-mono">
            @{variable.key}
          </kbd>
        </div>
        <p className="text-xs text-muted-foreground truncate">{variable.description}</p>
      </div>
    </div>
  )
}

function VariableDetailPanel({
  variable,
  onClose
}: {
  variable: (typeof TEMPLATE_VARIABLES)[0]
  onClose: () => void
}) {
  return (
    <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{variable.icon}</span>
          <div>
            <h4 className="font-semibold">{variable.label}</h4>
            <code className="text-xs text-muted-foreground font-mono">
              {"{{" + variable.key + "}}"}
            </code>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium text-muted-foreground">Description: </span>
          <span>{variable.description}</span>
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Example: </span>
          <code className="bg-background px-1.5 py-0.5 rounded text-xs">
            {variable.example}
          </code>
        </div>

        {variable.key === 'company_name' && (
          <div className="mt-3 p-2 bg-background/50 rounded border text-xs">
            <strong>Extraction logic:</strong> Extracts from website URL by
            removing common prefixes (www.) and suffixes (.com, .org, etc.),
            then capitalizes each part. For example:
            <ul className="mt-1 ml-4 list-disc space-y-0.5 text-muted-foreground">
              <li>https://www.example.com → Example</li>
              <li>https://acme-corp.io → Acme Corp</li>
              <li>https://tech-startup.co.uk → Tech Startup</li>
            </ul>
          </div>
        )}

        {variable.key === 'receiver_name' && (
          <div className="mt-3 p-2 bg-background/50 rounded border text-xs">
            <strong>Extraction logic:</strong> Extracts from recipient email by
            splitting on dots, hyphens, or underscores and capitalizing each part.
            For example:
            <ul className="mt-1 ml-4 list-disc space-y-0.5 text-muted-foreground">
              <li>john.doe@example.com → John Doe</li>
              <li>sarah-smith@email.com → Sarah Smith</li>
              <li>admin@company.com → admin</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
