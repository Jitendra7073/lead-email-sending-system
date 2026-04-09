/**
 * Variable Input Component
 * Text input with @ mention support for template variables
 */

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { TEMPLATE_VARIABLES, VariableValues, replaceTemplateVariables } from "@/lib/template-variables"
import { VariableMenu } from "./variable-menu"

interface VariableInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  variables?: VariableValues
}

export function VariableInput({
  value,
  onChange,
  variables,
  className,
  ...props
}: VariableInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [triggerRange, setTriggerRange] = React.useState<{ start: number; end: number } | null>(null)

  // Get cursor position in pixels
  const getCursorCoordinates = React.useCallback(() => {
    const input = inputRef.current
    if (!input) return null

    const rect = input.getBoundingClientRect()
    const textBeforeCursor = value.substring(0, input.selectionStart || 0)

    // Create a temporary span to measure text width
    const span = document.createElement('span')
    const styles = window.getComputedStyle(input)
    // Apply font styles directly
    span.style.fontWeight = styles.fontWeight
    span.style.fontSize = styles.fontSize
    span.style.fontFamily = styles.fontFamily
    span.style.letterSpacing = styles.letterSpacing
    span.style.textTransform = styles.textTransform
    span.style.whiteSpace = 'pre'
    span.style.position = 'absolute'
    span.style.visibility = 'hidden'
    span.textContent = textBeforeCursor
    document.body.appendChild(span)

    const textWidth = span.offsetWidth
    document.body.removeChild(span)

    // Calculate position
    const scrollLeft = input.scrollLeft
    const paddingLeft = parseFloat(styles.paddingLeft)

    return {
      x: rect.left + textWidth - scrollLeft + paddingLeft,
      y: rect.bottom + 4
    }
  }, [value])

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    const input = inputRef.current
    if (!input) return

    const cursorPosition = input.selectionEnd || newValue.length

    // Check if we just typed @
    if (newValue[cursorPosition - 1] === '@') {
      const coords = getCursorCoordinates()
      if (coords) {
        setMenuPosition(coords)
        setSearchQuery("")
        setTriggerRange({ start: cursorPosition - 1, end: cursorPosition })
      }
    } else if (menuPosition && triggerRange) {
      // Update search query while menu is open
      const queryStart = triggerRange.start + 1
      const query = newValue.substring(queryStart, cursorPosition).toLowerCase()
      setSearchQuery(query)

      // Close menu if space or invalid character
      if (/\s/.test(newValue[cursorPosition - 1]) || query.includes('@')) {
        setMenuPosition(null)
        setTriggerRange(null)
      }
    }
  }

  // Handle variable selection
  const handleSelectVariable = (variable: { id: string; label: string }) => {
    if (!triggerRange) return

    const variableText = `{{${variable.label}}}`
    const before = value.substring(0, triggerRange.start)
    const after = value.substring(triggerRange.end)

    onChange(before + variableText + after)

    // Move cursor after the inserted variable
    setTimeout(() => {
      const input = inputRef.current
      if (input) {
        const newPosition = triggerRange.start + variableText.length
        input.setSelectionRange(newPosition, newPosition)
        input.focus()
      }
    }, 0)

    setMenuPosition(null)
    setTriggerRange(null)
    setSearchQuery("")
  }

  // Close menu
  const handleCloseMenu = () => {
    setMenuPosition(null)
    setTriggerRange(null)
    setSearchQuery("")
  }

  // Close menu on blur
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay to allow menu item clicks to register
    setTimeout(() => {
      if (!document.querySelector('.variable-menu:hover')) {
        handleCloseMenu()
      }
    }, 100)
    props.onBlur?.(e)
  }

  // Close menu on escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuPosition) {
        e.preventDefault()
        handleCloseMenu()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuPosition])

  // Format display value with highlighted variables
  const displayValue = value
  const variableMatches = Array.from(displayValue.matchAll(/\{\{(\w+)\}\}/g))

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(
          "w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20",
          className
        )}
        {...props}
      />

      {menuPosition && (
        <div className="variable-menu">
          <VariableMenu
            position={menuPosition}
            onSelect={handleSelectVariable}
            onClose={handleCloseMenu}
            searchQuery={searchQuery}
          />
        </div>
      )}
    </div>
  )
}
