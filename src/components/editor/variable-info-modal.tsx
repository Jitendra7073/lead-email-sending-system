/**
 * Variable Info Modal Component
 * Displays a modal with all template variables in a table format
 */

"use client"

import * as React from "react"
import { Info } from "lucide-react"
import { TEMPLATE_VARIABLES } from "@/lib/template-variables"

export function VariableInfoModal({
  onClose
}: {
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-2xl animate-in fade-in duration-300 zoom-in-95 slide-in-from-top-[5%] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Template Variables</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm text-muted-foreground mb-4">
            Type <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">@</kbd> in the subject or content to insert variables.
          </p>

          {/* Variables Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Variable</th>
                  <th className="px-4 py-2.5 text-left font-medium">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <tr key={variable.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{variable.icon}</span>
                        <div>
                          <div className="font-medium">{variable.label}</div>
                          <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                            {"{{" + variable.key + "}}"}
                          </code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {variable.description}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-background border px-1.5 py-0.5 rounded">
                        {variable.example}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Additional Info */}
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">📧 Extracting Receiver Name</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Extracted from recipient email by splitting on dots, hyphens, or underscores.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <code className="bg-background border px-2 py-1 rounded">john.doe@example.com → John Doe</code>
                <code className="bg-background border px-2 py-1 rounded">sarah-smith@email.com → Sarah Smith</code>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border">
              <h4 className="font-medium text-sm mb-2">🏢 Extracting Company Name</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Extracted from website URL by removing common prefixes and suffixes.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <code className="bg-background border px-2 py-1 rounded">example.com → Example</code>
                <code className="bg-background border px-2 py-1 rounded">acme-corp.io → Acme Corp</code>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t bg-muted/30 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}
