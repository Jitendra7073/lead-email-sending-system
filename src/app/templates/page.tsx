"use client"

import * as React from "react"
import { Plus, Search, Eye, Edit, Trash2, FileText, Loader2, Info, Mail, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AccordionItem } from "@/components/ui/accordion"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { VariableInput } from "@/components/editor/variable-input"
import { VariableInfoModal } from "@/components/editor/variable-info-modal"
import { cn } from "@/lib/utils"

interface Template {
  id: string
  name: string
  subject: string
  html_content: string
  text_content?: string
  category: string
  description?: string
  tags?: string
  created_at: string
  is_active: boolean
}

// Predefined email categories
const emailCategories = [
  "Welcome",
  "Onboarding",
  "Promotion",
  "Newsletter",
  "Follow-up",
  "Reminder",
  "Announcement",
  "Survey",
  "Invitation",
  "Thank You",
  "Re-engagement",
  "Product Update",
  "Event",
  "Transactional",
  "Marketing",
]

export default function TemplatesPage() {
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showCreateModal, setShowCreateModal] = React.useState(false)
  const [showViewModal, setShowViewModal] = React.useState(false)
  const [showEditModal, setShowEditModal] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<Template | null>(null)
  const [selectedTemplate, setSelectedTemplate] = React.useState<Template | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [expandedAccordion, setExpandedAccordion] = React.useState<'details' | 'content' | null>(null)
  const [categoryInputType, setCategoryInputType] = React.useState<"select" | "custom">("select")
  const [showSequenceEditModal, setShowSequenceEditModal] = React.useState(false)
  const [showVariableInfoModal, setShowVariableInfoModal] = React.useState(false)
  const [tempSequenceNumber, setTempSequenceNumber] = React.useState<number>(1)
  const [formData, setFormData] = React.useState({
    name: '',
    subject: '',
    html_content: '',
    category: 'general',
    sequence_number: undefined as number | undefined
  })

  React.useEffect(() => {
    fetchTemplates()
  }, [])

  // Get sequence number for a template based on category
  function getSequenceNumber(category: string, currentTemplateId?: string): number {
    // Filter templates with same category
    const sameCategoryTemplates = templates.filter(
      (t) => t.category === category && t.id !== currentTemplateId
    )

    // Sort by name to find the highest sequence number
    const sequenceNumbers = sameCategoryTemplates.map((t) => {
      const match = t.name.match(new RegExp(`^${category}\\s*(\\d+)`, "i"))
      return match ? parseInt(match[1]) : 0
    })

    const maxNum = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0

    // Check if current template has a custom sequence number
    if (currentTemplateId && formData.sequence_number) {
      return formData.sequence_number
    }

    return maxNum + 1
  }

  async function fetchTemplates() {
    try {
      const res = await fetch("/api/templates")
      const json = await res.json()
      if (json.success) setTemplates(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTemplate() {
    setIsSaving(true)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sequence_number: formData.sequence_number || getSequenceNumber(formData.category)
        })
      })
      const json = await res.json()
      if (json.success) {
        await fetchTemplates()
        setShowCreateModal(false)
        setFormData({ name: '', subject: '', html_content: '', category: 'general', sequence_number: undefined })
        setExpandedAccordion(null)
        setCategoryInputType('select')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdateTemplate() {
    if (!selectedTemplate) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/templates/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sequence_number: formData.sequence_number || getSequenceNumber(formData.category, selectedTemplate.id)
        })
      })
      const json = await res.json()
      if (json.success) {
        await fetchTemplates()
        setShowEditModal(false)
        setSelectedTemplate(null)
        setFormData({ name: '', subject: '', html_content: '', category: 'general', sequence_number: undefined })
        setExpandedAccordion(null)
        setCategoryInputType('select')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteTemplate() {
    if (!showDeleteConfirm) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/templates/${showDeleteConfirm.id}`, {
        method: "DELETE"
      })
      const json = await res.json()
      if (json.success) {
        await fetchTemplates()
        setShowDeleteConfirm(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
  }

  function openViewModal(template: Template) {
    setSelectedTemplate(template)
    setShowViewModal(true)
  }

  function openEditModal(template: Template) {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      category: template.category || 'general',
      sequence_number: (template as any).sequence_number
    })
    setShowEditModal(true)
    setExpandedAccordion('details')
    setCategoryInputType('select')
  }

  function openCreateModal() {
    setFormData({ name: '', subject: '', html_content: '', category: 'general', sequence_number: undefined })
    setShowCreateModal(true)
    setExpandedAccordion(null)
    setCategoryInputType('select')
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Email Templates</h2>
          <p className="text-muted-foreground">Design and manage reusable content for your campaigns.</p>
        </div>
        <Button className="gap-2" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
          <FileText className="h-12 w-12 mb-4 text-muted-foreground" />
          <p className="text-xl font-medium">No templates found</p>
          <p className="text-sm text-muted-foreground mt-2">Create your first email template to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onView={() => openViewModal(template)}
              onEdit={() => openEditModal(template)}
              onDelete={() => setShowDeleteConfirm(template)}
            />
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <Modal
          title="Create New Template"
          onClose={() => {
            setShowCreateModal(false)
            setFormData({ name: '', subject: '', html_content: '', category: 'general', sequence_number: undefined })
            setExpandedAccordion(null)
            setCategoryInputType('select')
          }}
          onSave={handleCreateTemplate}
          isLoading={isSaving}
          size="large"
          showVariablesButton={true}
          onVariablesClick={() => setShowVariableInfoModal(true)}>
          <div className="space-y-4">
            {/* Accordion 1: Template Details */}
            <AccordionItem
              title="Template Details"
              icon={<Info className="h-4 w-4" />}
              description={formData.name || "Configure template name, category, and subject"}
              isExpanded={expandedAccordion === 'details'}
              onToggle={() => setExpandedAccordion(expandedAccordion === 'details' ? null : 'details')}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Template Name</label>
                  <input
                    type="text"
                    className="w-full mt-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Welcome Email"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    {categoryInputType === "select" ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          className="flex-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.category || ""}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setCategoryInputType("custom")
                              setFormData({
                                ...formData,
                                category: "",
                              })
                            } else {
                              setFormData({
                                ...formData,
                                category: e.target.value,
                              })
                            }
                          }}>
                          <option value="">Select category...</option>
                          {emailCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="custom">✏️ Custom...</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          className="flex-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.category || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              category: e.target.value,
                            })
                          }
                          placeholder="Enter custom category..."
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => setCategoryInputType("select")}
                          title="Back to dropdown">
                          ✕
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Sequence Number */}
                  {formData.category && (
                    <div>
                      <label className="text-sm font-medium">
                        Sequence Number
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-10 px-3 bg-muted/50 border rounded-lg flex items-center">
                          <span className="text-sm font-medium">
                            {formData.category}{" "}
                            {getSequenceNumber(
                              formData.category,
                              selectedTemplate?.id,
                            )}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 gap-1"
                          onClick={() => {
                            setTempSequenceNumber(
                              getSequenceNumber(
                                formData.category,
                                selectedTemplate?.id,
                              ),
                            )
                            setShowSequenceEditModal(true)
                          }}
                          title="Edit sequence number">
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Subject Line</label>
                  <VariableInput
                    value={formData.subject}
                    onChange={(value) => setFormData({ ...formData, subject: value })}
                    placeholder="Welcome to our service!"
                    className="mt-1"
                  />
                </div>
              </div>
            </AccordionItem>

            {/* Accordion 2: Email Content */}
            <AccordionItem
              title="Email Content"
              icon={<Edit className="h-4 w-4" />}
              description={formData.subject || "Write your email content with the visual editor"}
              isExpanded={expandedAccordion === 'content'}
              onToggle={() => setExpandedAccordion(expandedAccordion === 'content' ? null : 'content')}>
              <RichTextEditor
                value={formData.html_content}
                onChange={(value) => setFormData({ ...formData, html_content: value })}
                placeholder="Start writing your email content..."
                minHeight="200px"
              />
            </AccordionItem>
          </div>
        </Modal>
      )}

      {/* View Template Modal */}
      {showViewModal && selectedTemplate && (
        <Modal
          title="Email Template Preview"
          onClose={() => {
            setShowViewModal(false)
            setSelectedTemplate(null)
          }}
          onSave={() => {
            setShowViewModal(false)
            setSelectedTemplate(null)
          }}
          saveText="Close"
          size="xlarge">
          <div className="space-y-4">
            {/* Email Header */}
            <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-t-lg border">
              <div className="p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs font-medium text-muted-foreground">From:</label>
                      <p className="text-sm truncate">sender@example.com</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs font-medium text-muted-foreground">To:</label>
                      <p className="text-sm truncate">recipient@example.com</p>
                    </div>
                  </div>
                </div>
                <div className="pl-11">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-medium text-muted-foreground">Subject:</label>
                    <p className="text-sm font-semibold truncate">{selectedTemplate.subject}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 max-w-full">
                <div
                  className="email-content prose prose-sm sm:prose-base max-w-none overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }}
                  style={{
                    lineHeight: '1.6',
                    color: '#334155'
                  }}
                />
              </div>
            </div>

            {/* Email Footer Info */}
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div>
                  <label className="font-medium text-muted-foreground">Category</label>
                  <p className="mt-1 text-sm truncate">{selectedTemplate.category || 'General'}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Created</label>
                  <p className="mt-1 text-sm">{new Date(selectedTemplate.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Status</label>
                  <p className="mt-1 text-sm">{selectedTemplate.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
            </div>
          </div>

          <style jsx global>{`
            .email-content {
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            .email-content p {
              margin-bottom: 1em;
              max-width: 100%;
            }
            .email-content h1, .email-content h2, .email-content h3 {
              margin-top: 1.5em;
              margin-bottom: 0.75em;
              font-weight: 600;
              word-wrap: break-word;
            }
            .email-content ul, .email-content ol {
              margin-left: 1.5em;
              margin-bottom: 1em;
              max-width: 100%;
            }
            .email-content li {
              margin-bottom: 0.5em;
            }
            .email-content a {
              color: #3b82f6;
              text-decoration: underline;
              word-break: break-word;
            }
            .email-content strong, .email-content b {
              font-weight: 600;
            }
            .email-content img {
              max-width: 100%;
              height: auto;
            }
            .email-content table {
              width: 100%;
              border-collapse: collapse;
              margin: 1em 0;
            }
            .email-content th, .email-content td {
              border: 1px solid #e2e8f0;
              padding: 0.5em;
            }
            .email-content blockquote {
              border-left: 4px solid #e2e8f0;
              padding-left: 1em;
              margin: 1em 0;
              color: #64748b;
            }
          `}</style>
        </Modal>
      )}

      {/* Edit Template Modal */}
      {showEditModal && selectedTemplate && (
        <Modal
          title="Edit Email Template"
          onClose={() => {
            setShowEditModal(false)
            setSelectedTemplate(null)
            setFormData({ name: '', subject: '', html_content: '', category: 'general', sequence_number: undefined })
            setExpandedAccordion(null)
            setCategoryInputType('select')
          }}
          onSave={handleUpdateTemplate}
          isLoading={isSaving}
          size="large"
          showVariablesButton={true}
          onVariablesClick={() => setShowVariableInfoModal(true)}>
          <div className="space-y-4">
            {/* Accordion 1: Template Details */}
            <AccordionItem
              title="Template Details"
              icon={<Info className="h-4 w-4" />}
              description={formData.name || "Configure template name, category, and subject"}
              isExpanded={expandedAccordion === 'details'}
              onToggle={() => setExpandedAccordion(expandedAccordion === 'details' ? null : 'details')}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Template Name</label>
                  <input
                    type="text"
                    className="w-full mt-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    {categoryInputType === "select" ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          className="flex-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.category || ""}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setCategoryInputType("custom")
                              setFormData({
                                ...formData,
                                category: "",
                              })
                            } else {
                              setFormData({
                                ...formData,
                                category: e.target.value,
                              })
                            }
                          }}>
                          <option value="">Select category...</option>
                          {emailCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="custom">✏️ Custom...</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          className="flex-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.category || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              category: e.target.value,
                            })
                          }
                          placeholder="Enter custom category..."
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => setCategoryInputType("select")}
                          title="Back to dropdown">
                          ✕
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Sequence Number */}
                  {formData.category && (
                    <div>
                      <label className="text-sm font-medium">
                        Sequence Number
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-10 px-3 bg-muted/50 border rounded-lg flex items-center">
                          <span className="text-sm font-medium">
                            {formData.category}{" "}
                            {getSequenceNumber(
                              formData.category,
                              selectedTemplate?.id,
                            )}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 gap-1"
                          onClick={() => {
                            setTempSequenceNumber(
                              getSequenceNumber(
                                formData.category,
                                selectedTemplate?.id,
                              ),
                            )
                            setShowSequenceEditModal(true)
                          }}
                          title="Edit sequence number">
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Subject Line</label>
                  <VariableInput
                    value={formData.subject}
                    onChange={(value) => setFormData({ ...formData, subject: value })}
                    placeholder="Welcome to our service!"
                    className="mt-1"
                  />
                </div>
              </div>
            </AccordionItem>

            {/* Accordion 2: Email Content */}
            <AccordionItem
              title="Email Content"
              icon={<Edit className="h-4 w-4" />}
              description={formData.subject || "Write your email content with the visual editor"}
              isExpanded={expandedAccordion === 'content'}
              onToggle={() => setExpandedAccordion(expandedAccordion === 'content' ? null : 'content')}>
              <RichTextEditor
                value={formData.html_content}
                onChange={(value) => setFormData({ ...formData, html_content: value })}
                placeholder="Start writing your email content..."
                minHeight="200px"
              />
            </AccordionItem>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> This will update the template for all sequences using it. The changes will apply immediately.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Sequence Number Edit Modal */}
      {showSequenceEditModal && (
        <Modal
          title={`Edit Sequence Number - ${formData.category || ""}`}
          onClose={() => setShowSequenceEditModal(false)}
          onSave={() => {
            setFormData({
              ...formData,
              sequence_number: tempSequenceNumber,
            })
            setShowSequenceEditModal(false)
          }}
          size="small">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sequence Number</label>
              <input
                type="number"
                min="1"
                className="w-full mt-2 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={tempSequenceNumber}
                onChange={(e) =>
                  setTempSequenceNumber(parseInt(e.target.value) || 1)
                }
              />
              <p className="text-xs text-muted-foreground mt-2">
                This will be displayed as{" "}
                <strong>
                  {formData.category || "Email"} {tempSequenceNumber}
                </strong>
              </p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Changing the sequence number will affect
                how this template is ordered in sequences. Make sure to update
                the template name to match the new sequence number.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          title="Delete Template"
          onClose={() => setShowDeleteConfirm(null)}
          onSave={handleDeleteTemplate}
          saveText="Delete"
          saveClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          isLoading={isDeleting}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>"{showDeleteConfirm.name}"</strong>?
            </p>
            <p className="text-sm text-destructive">
              This action cannot be undone.
            </p>
          </div>
        </Modal>
      )}

      {/* Variable Info Modal */}
      {showVariableInfoModal && (
        <VariableInfoModal
          onClose={() => setShowVariableInfoModal(false)}
        />
      )}
    </div>
  )
}

function TemplateCard({
  template,
  onView,
  onEdit,
  onDelete
}: {
  template: Template
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card className="group hover:shadow-md transition-all bg-card/50 border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-base truncate">{template.name}</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500 border border-blue-500/20 flex-shrink-0">
                {template.category || 'General'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-blue-500/10 hover:text-blue-500"
              onClick={onView}
              title="View template">
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-green-500/10 hover:text-green-500"
              onClick={onEdit}
              title="Edit template">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-red-500/10 hover:text-red-500"
              onClick={onDelete}
              title="Delete template">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Modal({
  title,
  onClose,
  onSave,
  saveText = "Save",
  saveClassName = "",
  size = "medium",
  isLoading = false,
  showVariablesButton = false,
  onVariablesClick,
  children
}: {
  title: string
  onClose: () => void
  onSave: () => void
  saveText?: string
  saveClassName?: string
  size?: "small" | "medium" | "large" | "xlarge" | "full"
  isLoading?: boolean
  showVariablesButton?: boolean
  onVariablesClick?: () => void
  children: React.ReactNode
}) {
  const sizeClasses = {
    small: "max-w-sm",
    medium: "max-w-md",
    large: "max-w-2xl",
    xlarge: "max-w-4xl",
    full: "max-w-5xl"
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={cn(
        "bg-card rounded-xl border shadow-lg w-full animate-in fade-in duration-300 zoom-in-95 slide-in-from-top-[5%] flex flex-col",
        sizeClasses[size],
        size === "full" ? "h-[90vh]" : "max-h-[90vh]"
      )}>
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="text-lg font-semibold truncate">{title}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0">{children}</div>

        <div className="flex items-center justify-between gap-3 p-4 border-t bg-muted/30 shrink-0">
          {/* Variable Info Button - Bottom Left */}
          {showVariablesButton && onVariablesClick && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onVariablesClick}>
              <Info className="h-4 w-4" />
              <span>Variables</span>
            </Button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={isLoading}
              className={saveClassName}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                saveText
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
