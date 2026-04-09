"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import ListItem from "@tiptap/extension-list-item"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  RemoveFormatting,
  Heading1,
  Heading2,
  Heading3,
  Variable
} from "lucide-react"
import { cn } from "@/lib/utils"
import { VariableMenu } from "@/components/editor/variable-menu"
import { VariableNode } from "@/components/editor/variable-node"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

const MenuBar = ({ editor }: { editor: ReturnType<typeof useEditor> | null }) => {
  if (!editor) return null

  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const setHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    editor.chain().focus().toggleHeading({ level }).run()
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-card border-b border-border rounded-t-lg">
      {/* Variables */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <ToolbarButton
          onClick={() => {
            // Insert variable trigger
            editor.chain().focus().insertContent('@').run()
          }}
          active={false}
          title="Insert Variable (type @ in editor)"
        >
          <Variable className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-1 pr-2 border-r border-border">
        <ToolbarButton
          onClick={() => setHeading(1)}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(2)}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(3)}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Text Formatting */}
      <div className="flex items-center gap-1 px-2 border-r border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-1 px-2 border-r border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 px-2 border-r border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Link */}
      <div className="flex items-center gap-1 px-2 border-r border-border">
        <ToolbarButton
          onClick={addLink}
          active={editor.isActive('link')}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Clear Formatting */}
      <div className="flex items-center gap-1 pl-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  active = false,
  title = ""
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active && "bg-primary text-primary-foreground hover:bg-primary/90"
      )}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing your email content...",
  className,
  minHeight = "300px"
}: RichTextEditorProps) {
  const editorRef = React.useRef<ReturnType<typeof useEditor> | null>(null)
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [triggerCoords, setTriggerCoords] = React.useState<{ pos: number; coords: { x: number; y: number } } | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        listItem: false,
      }),
      ListItem,
      VariableNode,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none px-4 py-3',
        'data-placeholder': placeholder,
      },
      handleKeyDown: (view, event) => {
        // Handle @ trigger
        if (event.key === '@') {
          // Let the @ be inserted, then show menu
          setTimeout(() => {
            const { state, view: editorView } = editorRef.current || {}
            if (!state || !editorView) return

            const { selection } = state
            const coords = editorView.coordsAtPos(selection.from)

            // Calculate menu position
            const menuX = coords.left
            const menuY = coords.bottom + 4

            setMenuPosition({ x: menuX, y: menuY })
            setTriggerCoords({ pos: selection.from - 1, coords: { x: menuX, y: menuY } })
            setSearchQuery("")
          }, 0)
        }

        // Close menu on escape
        if (event.key === 'Escape' && menuPosition) {
          setMenuPosition(null)
          setTriggerCoords(null)
          setSearchQuery("")
          return true
        }

        return false
      },
    },
  })

  editorRef.current = editor

  // Update editor content when value changes externally
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  // Handle variable selection
  const handleSelectVariable = (variable: { id: string; label: string }) => {
    if (!editor || !triggerCoords) return

    // Delete the @ and insert the variable node
    editor
      .chain()
      .focus()
      .deleteRange({ from: triggerCoords.pos, to: editor.state.selection.from })
      .insertContent({
        type: 'variable',
        attrs: {
          id: variable.id,
          label: variable.label,
        },
      })
      .run()

    setMenuPosition(null)
    setTriggerCoords(null)
    setSearchQuery("")
  }

  // Close menu handler
  const handleCloseMenu = () => {
    setMenuPosition(null)
    setTriggerCoords(null)
    setSearchQuery("")
  }

  return (
    <div className={cn("rich-text-editor border border-border rounded-lg overflow-hidden bg-card", className)}>
      <MenuBar editor={editor} />

      <style jsx global>{`
        /* Tiptap Editor Styles */
        .ProseMirror {
          min-height: 150px;
          max-height: 360px;
          overflow-y: auto;
          color: #334155;
          line-height: 1.6;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }

        .ProseMirror:focus {
          outline: none;
        }

        .ProseMirror p {
          margin-bottom: 0.5em;
        }

        .ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }

        .ProseMirror h1 { font-size: 1.5em; }
        .ProseMirror h2 { font-size: 1.25em; }
        .ProseMirror h3 { font-size: 1.125em; }

        .ProseMirror strong {
          font-weight: 600;
        }

        .ProseMirror em {
          font-style: italic;
        }

        .ProseMirror code {
          background-color: #f1f5f9;
          padding: 0.2em 0.4em;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }

        .ProseMirror pre {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1em;
          margin: 1em 0;
        }

        .ProseMirror pre code {
          background: none;
          padding: 0;
        }

        .ProseMirror ul, .ProseMirror ol {
          margin-left: 1.5em;
          margin-bottom: 0.5em;
        }

        .ProseMirror li {
          margin-bottom: 0.25em;
        }

        .ProseMirror blockquote {
          border-left: 4px solid #e2e8f0;
          padding-left: 1em;
          margin: 1em 0;
          color: #64748b;
        }

        .ProseMirror a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .ProseMirror hr {
          border: none;
          border-top: 2px solid #e2e8f0;
          margin: 2em 0;
        }

        /* Template Variables */
        .ProseMirror .template-variable {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          background-color: hsl(var(--blue-100) / 0.3);
          color: hsl(var(--blue-700));
          font-weight: 500;
          font-size: 0.875rem;
          white-space: nowrap;
        }

        .dark .ProseMirror .template-variable {
          background-color: hsl(var(--blue-900) / 0.3);
          color: hsl(var(--blue-300));
        }
      `}</style>

      <EditorContent editor={editor} />

      {menuPosition && (
        <VariableMenu
          position={menuPosition}
          onSelect={handleSelectVariable}
          onClose={handleCloseMenu}
          searchQuery={searchQuery}
        />
      )}

      {!editor && (
        <div className="p-4 text-center text-muted-foreground">
          Loading editor...
        </div>
      )}
    </div>
  )
}
