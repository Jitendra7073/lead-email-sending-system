/**
 * Variable Node Extension for TipTap
 * A simple node extension for template variables
 */

import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      /**
       * Insert a variable mention
       */
      insertVariable: (attrs: { id: string; label: string }) => ReturnType
    }
  }
}

export const VariableNode = Node.create({
  name: 'variable',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) return {}
          return { 'data-id': attributes.id }
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) return {}
          return { 'data-label': attributes.label }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="variable"]',
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-type': 'variable',
        'data-id': node.attrs.id,
        'data-label': node.attrs.label,
        class: 'template-variable inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium text-sm select-none',
      },
      `{{${node.attrs.label}}}`,
    ]
  },

  renderText({ node }) {
    return `{{${node.attrs.label}}}`
  },

  addCommands() {
    return {
      insertVariable:
        attrs =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },
    }
  },
})
