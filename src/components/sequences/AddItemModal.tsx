"use client"

import * as React from "react"
import { Search, Plus, Clock, Mail, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface AddItemModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (templateId: string, delayDays: number, sendTime: string) => Promise<{ success: boolean; error?: string }>
  templates: any[]
  sequenceName?: string
}

export function AddItemModal({
  isOpen,
  onClose,
  onAdd,
  templates,
  sequenceName
}: AddItemModalProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<any[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [selectedTemplate, setSelectedTemplate] = React.useState<any | null>(null)
  const [delayDays, setDelayDays] = React.useState(0)
  const [sendTime, setSendTime] = React.useState("09:00")
  const [isAdding, setIsAdding] = React.useState(false)
  const isAddingRef = React.useRef(false)

  // Search templates function
  const searchTemplates = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(`/api/templates?search=${encodeURIComponent(query)}`)
      const json = await res.json()
      if (json.success) {
        setSearchResults(json.data)
      }
    } catch (error) {
      console.error("Error searching templates:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchTemplates(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const displayTemplates = searchQuery ? searchResults : []

  const handleAdd = async () => {
    if (!selectedTemplate || isAddingRef.current) return

    isAddingRef.current = true
    setIsAdding(true)

    try {
      const result = await onAdd(selectedTemplate.id, delayDays, sendTime)

      if (result.success) {
        toast.success("Template added to sequence successfully", {
          id: "add-template-success",
          description: `${selectedTemplate.name} will be sent after ${delayDays} day(s) at ${sendTime}`
        })
        // Reset form
        setSearchQuery("")
        setSearchResults([])
        setSelectedTemplate(null)
        setDelayDays(0)
        setSendTime("09:00")
      } else {
        toast.error(result.error || "Failed to add template", {
          id: "add-template-error",
          description: result.error || "Please try again"
        })
      }
    } catch (error: any) {
      toast.error("Failed to add template", {
        id: "add-template-catch",
        description: error.message || "An unexpected error occurred"
      })
    } finally {
      setIsAdding(false)
      isAddingRef.current = false
    }
  }

  const handleClose = () => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedTemplate(null)
    setDelayDays(0)
    setSendTime("09:00")
    onClose()
  }

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-lg animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Add Template to Sequence</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">

          {/* Search Field */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full h-11 pl-10 pr-4 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search templates by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Helper Text */}
          {!searchQuery && !selectedTemplate && (
            <p className="text-xs text-muted-foreground text-center">
              Search to find and select a template
            </p>
          )}

          {/* Search Results */}
          {searchQuery && !selectedTemplate && (
            <div className="space-y-2">
              {displayTemplates.length > 0 ? (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {displayTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:bg-accent/50 border-border bg-card"
                    >
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{template.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.subject || 'No subject'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">No templates found</p>
                </div>
              )}
            </div>
          )}

          {/* Selected Template Expanded View */}
          {selectedTemplate && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Selected Template Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Selected</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedTemplate(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{selectedTemplate.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedTemplate.subject || 'No subject'}</p>
                  </div>
                </div>
              </div>

              {/* Schedule Settings */}
              <div className="bg-muted/30 border border-border/60 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <h4 className="text-xs font-medium">Schedule this email</h4>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Delay Days */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                      After previous
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        className="w-full h-9 px-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        placeholder="0"
                        value={delayDays}
                        onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">days</span>
                    </div>
                  </div>

                  {/* Time of Day */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                      Send at time
                    </label>
                    <input
                      type="time"
                      className="w-full h-9 px-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      value={sendTime}
                      onChange={(e) => setSendTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Add Button */}
              <Button
                className="w-full gap-2"
                onClick={handleAdd}
                disabled={isAdding}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Template to Sequence
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
