/**
 * Variable Menu Component
 * Dropdown menu that appears when typing @ in the editor
 */

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TEMPLATE_VARIABLES } from "@/lib/template-variables"

interface VariableMenuProps {
  position: { x: number; y: number }
  onSelect: (variable: { id: string; label: string }) => void
  onClose: () => void
  searchQuery?: string
}

export function VariableMenu({
  position,
  onSelect,
  onClose,
  searchQuery = ""
}: VariableMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  // Filter variables based on search query
  const filteredVariables = React.useMemo(() => {
    if (!searchQuery) {
      return TEMPLATE_VARIABLES
    }
    const query = searchQuery.toLowerCase()
    return TEMPLATE_VARIABLES.filter(
      v =>
        v.key.toLowerCase().includes(query) ||
        v.label.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < filteredVariables.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filteredVariables[selectedIndex]
        if (selected) {
          onSelect({ id: selected.key, label: selected.key })
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredVariables, selectedIndex, onSelect, onClose])

  // Reset selection when filtered list changes
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (filteredVariables.length === 0) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 bg-popover border rounded-lg shadow-lg animate-in fade-in zoom-in-95"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      <div className="p-2">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground mb-1">
          Insert Variable
        </div>
        {filteredVariables.map((variable, index) => (
          <button
            key={variable.key}
            type="button"
            className={cn(
              "w-full flex items-center gap-3 px-2 py-2 rounded-md text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              index === selectedIndex && "bg-accent"
            )}
            onClick={() => onSelect({ id: variable.key, label: variable.key })}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="text-lg">{variable.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{variable.label}</div>
              <div className="text-xs text-muted-foreground truncate">
                {variable.description}
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
              @{variable.key}
            </div>
          </button>
        ))}
      </div>
      <div className="border-t px-2 py-1.5 bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono text-[10px]">
            ↑↓
          </kbd>
          <span>to navigate</span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded font-mono text-[10px]">
            Enter
          </kbd>
          <span>to select</span>
        </div>
      </div>
    </div>
  )
}
