"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Mail,
  Clock,
  Edit,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GripVertical,
  X,
  Save,
  Calendar,
  Eye,
  Info,
  Loader2,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { AccordionItem } from "@/components/ui/accordion";
import { AddItemModal } from "@/components/sequences/AddItemModal";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  template_name: string;
  template_subject: string;
  position: number;
  delay_days: number;
  send_time: string;
}

interface Sequence {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  items?: Template[];
}

export default function SequencesPage() {
  const [sequences, setSequences] = React.useState<Sequence[]>([]);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showInactive, setShowInactive] = React.useState(false);
  const [expandedSequences, setExpandedSequences] = React.useState<Set<string>>(
    new Set(),
  );
  const [editingSequence, setEditingSequence] = React.useState<Sequence | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] =
    React.useState<Sequence | null>(null);
  const [showAddItemModal, setShowAddItemModal] = React.useState(false);
  const [selectedSequenceForItem, setSelectedSequenceForItem] =
    React.useState<Sequence | null>(null);
  const [draggedItem, setDraggedItem] = React.useState<{
    sequenceId: string;
    itemId: string;
    index: number;
  } | null>(null);
  const [previewItem, setPreviewItem] = React.useState<any | null>(null);
  const [editItem, setEditItem] = React.useState<any | null>(null);
  const [fullTemplateData, setFullTemplateData] = React.useState<any | null>(
    null,
  );
  const [categoryInputType, setCategoryInputType] = React.useState<
    "select" | "custom"
  >("select");
  const [showSequenceEditModal, setShowSequenceEditModal] =
    React.useState(false);
  const [tempSequenceNumber, setTempSequenceNumber] = React.useState<number>(1);
  const [expandedAccordion, setExpandedAccordion] = React.useState<
    "details" | "content" | "sequence" | null
  >(null);
  const [editItemDelayDays, setEditItemDelayDays] = React.useState(0);
  const [editItemSendTime, setEditItemSendTime] = React.useState("09:00");

  // Action loading states
  const [isCreatingSequence, setIsCreatingSequence] = React.useState(false);
  const [isDeletingSequence, setIsDeletingSequence] = React.useState(false);
  const [togglingSequenceId, setTogglingSequenceId] = React.useState<
    string | null
  >(null);
  const [removingItemId, setRemovingItemId] = React.useState<string | null>(
    null,
  );
  const [isUpdatingTemplate, setIsUpdatingTemplate] = React.useState(false);

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
  ];

  // Form states
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    is_active: true,
  });

  // Get sequence number for a template based on category
  function getSequenceNumber(
    category: string,
    currentTemplateId?: string,
  ): number {
    // Filter templates with same category
    const sameCategoryTemplates = templates.filter(
      (t) => t.category === category && t.id !== currentTemplateId,
    );

    // Sort by name to find the highest sequence number
    const sequenceNumbers = sameCategoryTemplates.map((t) => {
      const match = t.name.match(new RegExp(`^${category}\\s*(\\d+)`, "i"));
      return match ? parseInt(match[1]) : 0;
    });

    const maxNum =
      sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0;

    // Check if current template has a custom sequence number
    if (currentTemplateId && fullTemplateData?.sequence_number) {
      return fullTemplateData.sequence_number;
    }

    return maxNum + 1;
  }

  const [itemFormData, setItemFormData] = React.useState({
    template_id: "",
    delay_days: 0,
    send_time: "09:00",
  });

  React.useEffect(() => {
    async function fetchData() {
      try {
        const [seqRes, tempRes] = await Promise.all([
          fetch(`/api/sequences?include_inactive=${showInactive}`),
          fetch("/api/templates"),
        ]);

        const seqJson = await seqRes.json();
        const tempJson = await tempRes.json();

        if (seqJson.success)
          setSequences(
            (seqJson.data || []).map((seq: any) => ({
              ...seq,
              items: seq.items || [],
            })),
          );
        if (tempJson.success) setTemplates(tempJson.data);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [showInactive]);

  const filteredSequences = sequences.filter((seq) => {
    const matchesSearch =
      seq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (seq.description &&
        seq.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  async function handleCreateSequence() {
    setIsCreatingSequence(true);
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.success) {
        setSequences([json.data, ...sequences]);
        setShowAddModal(false);
        setFormData({ name: "", description: "", is_active: true });
        toast.success("Sequence created successfully", {
          description: json.data.name,
        });
      } else {
        toast.error(json.error || "Failed to create sequence");
      }
    } catch (err) {
      console.error("Error creating sequence:", err);
      toast.error("Failed to create sequence");
    } finally {
      setIsCreatingSequence(false);
    }
  }

  async function handleUpdateSequence() {
    if (!editingSequence) return;

    try {
      const res = await fetch("/api/sequences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSequence.id,
          ...formData,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSequences(
          sequences.map((seq) =>
            seq.id === editingSequence.id
              ? {
                  ...json.data,
                  items: seq.items || [],
                }
              : seq,
          ),
        );
        setShowEditModal(false);
        setEditingSequence(null);
        setFormData({ name: "", description: "", is_active: true });
      }
    } catch (err) {
      console.error("Error updating sequence:", err);
    }
  }

  async function handleToggleActive(sequence: Sequence) {
    setTogglingSequenceId(sequence.id);
    try {
      const res = await fetch("/api/sequences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sequence.id,
          name: sequence.name,
          description: sequence.description,
          is_active: !sequence.is_active,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSequences(
          sequences.map((seq) =>
            seq.id === sequence.id
              ? {
                  ...json.data,
                  items: seq.items || [],
                }
              : seq,
          ),
        );
        const newStatus = !sequence.is_active ? "activated" : "deactivated";
        toast.success(`Sequence ${newStatus}`, {
          description: sequence.name,
        });
      } else {
        toast.error(json.error || "Failed to update sequence");
      }
    } catch (err) {
      console.error("Error toggling sequence:", err);
      toast.error("Failed to update sequence");
    } finally {
      setTogglingSequenceId(null);
    }
  }

  async function handleDeleteSequence() {
    if (!showDeleteConfirm) return;

    setIsDeletingSequence(true);
    try {
      const res = await fetch(`/api/sequences?id=${showDeleteConfirm.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (json.success) {
        setSequences(
          sequences.filter((seq) => seq.id !== showDeleteConfirm.id),
        );
        setShowDeleteConfirm(null);
        toast.success("Sequence deleted successfully");
      } else {
        toast.error(json.error || "Failed to delete sequence");
      }
    } catch (err) {
      console.error("Error deleting sequence:", err);
      toast.error("Failed to delete sequence");
    } finally {
      setIsDeletingSequence(false);
    }
  }

  async function handleAddItem(
    templateId?: string,
    delayDays?: number,
    sendTime?: string,
  ) {
    if (!selectedSequenceForItem)
      return { success: false, error: "No sequence selected" };

    // Use passed params or fall back to state
    const data = {
      template_id: templateId || itemFormData.template_id,
      delay_days: delayDays ?? itemFormData.delay_days,
      send_time: sendTime || itemFormData.send_time,
    };

    try {
      const res = await fetch(
        `/api/sequences/${selectedSequenceForItem.id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      const json = await res.json();
      if (json.success) {
        // Refresh sequences
        const seqRes = await fetch("/api/sequences");
        const seqJson = await seqRes.json();
        if (seqJson.success) {
          setSequences(seqJson.data);
        }
        setShowAddItemModal(false);
        setItemFormData({ template_id: "", delay_days: 0, send_time: "09:00" });
        setSelectedSequenceForItem(null);
        return { success: true };
      } else {
        return {
          success: false,
          error: json.error || "Failed to add template",
        };
      }
    } catch (err: any) {
      console.error("Error adding item:", err);
      return {
        success: false,
        error: err.message || "An unexpected error occurred",
      };
    }
  }

  async function handleRemoveItem(sequenceId: string, itemId: string) {
    setRemovingItemId(itemId);
    try {
      const res = await fetch(
        `/api/sequences/${sequenceId}/items?item_id=${itemId}`,
        {
          method: "DELETE",
        },
      );

      const json = await res.json();
      if (json.success) {
        setSequences(
          sequences.map((seq) => {
            if (seq.id === sequenceId) {
              return {
                ...seq,
                items: (seq.items || []).filter((item) => item.id !== itemId),
              };
            }
            return seq;
          }),
        );
        toast.success("Template removed from sequence");
      } else {
        toast.error(json.error || "Failed to remove template");
      }
    } catch (err) {
      console.error("Error removing item:", err);
      toast.error("Failed to remove template");
    } finally {
      setRemovingItemId(null);
    }
  }

  async function handleUpdateTemplate() {
    if (!fullTemplateData) return;

    setIsUpdatingTemplate(true);
    try {
      // Update template
      const res = await fetch(`/api/templates/${fullTemplateData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullTemplateData.name,
          subject: fullTemplateData.subject,
          html_content: fullTemplateData.html_content,
          category: fullTemplateData.category,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Also update sequence item settings if editing from sequence
        if (editItem && editItem.sequenceId) {
          await fetch(`/api/sequences/${editItem.sequenceId}/items`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item_id: editItem.id,
              delay_days: editItemDelayDays,
              send_time: editItemSendTime,
            }),
          });
        }

        // Refetch templates and sequences
        const [tempRes, seqRes] = await Promise.all([
          fetch("/api/templates"),
          fetch(`/api/sequences?include_inactive=${showInactive}`),
        ]);
        const [tempJson, seqJson] = await Promise.all([
          tempRes.json(),
          seqRes.json(),
        ]);

        if (tempJson.success) setTemplates(tempJson.data);
        if (seqJson.success)
          setSequences(
            (seqJson.data || []).map((seq: any) => ({
              ...seq,
              items: seq.items || [],
            })),
          );

        toast.success("Template updated successfully");
        setEditItem(null);
        setFullTemplateData(null);
      } else {
        toast.error(json.error || "Failed to update template");
      }
    } catch (err) {
      console.error("Error updating template:", err);
      toast.error("Failed to update template");
    } finally {
      setIsUpdatingTemplate(false);
    }
  }

  async function handlePreviewItem(item: any) {
    try {
      // Fetch full template data
      const res = await fetch(`/api/templates/${item.template_id}`);
      const json = await res.json();
      if (json.success) {
        setPreviewItem(item);
        setFullTemplateData(json.data);
      }
    } catch (err) {
      console.error("Error fetching template:", err);
    }
  }

  async function handleEditItem(sequenceId: string, item: any) {
    try {
      // Fetch full template data
      const res = await fetch(`/api/templates/${item.template_id}`);
      const json = await res.json();
      if (json.success) {
        setEditItem({ ...item, sequenceId });
        setFullTemplateData(json.data);
        setCategoryInputType("select");
        setEditItemDelayDays(item.delay_days || 0);
        setEditItemSendTime(item.send_time || "09:00");
        setExpandedAccordion("sequence");
      }
    } catch (err) {
      console.error("Error fetching template:", err);
    }
  }

  async function handleDropItem(
    sequenceId: string,
    draggedItemId: string,
    targetIndex: number,
  ) {
    const sequence = sequences.find((s) => s.id === sequenceId);
    if (!sequence) return;

    const items = [...(sequence.items || [])];
    const currentIndex = items.findIndex((i) => i.id === draggedItemId);
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    // Get the target item's position
    const targetItem = items[targetIndex];
    const newPosition = targetItem.position;

    try {
      const res = await fetch(`/api/sequences/${sequenceId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: draggedItemId,
          position: newPosition,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Refetch only this sequence's items to get the correct order
        const itemsRes = await fetch(`/api/sequences/${sequenceId}/items`);
        const itemsJson = await itemsRes.json();

        if (itemsJson.success) {
          setSequences((prevSequences) =>
            prevSequences.map((seq) => {
              if (seq.id === sequenceId) {
                return {
                  ...seq,
                  items: itemsJson.data,
                };
              }
              return seq;
            }),
          );
        }
      }
    } catch (err) {
      console.error("Error moving item:", err);
    }
  }

  function handleDragStart(sequenceId: string, itemId: string, index: number) {
    setDraggedItem({ sequenceId, itemId, index });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(
    e: React.DragEvent,
    sequenceId: string,
    targetIndex: number,
  ) {
    e.preventDefault();
    if (!draggedItem || draggedItem.sequenceId !== sequenceId) {
      setDraggedItem(null);
      return;
    }

    handleDropItem(sequenceId, draggedItem.itemId, targetIndex);
  }

  function handleDragEnd() {
    // Reset dragged item state when drag ends (whether dropped successfully or not)
    setDraggedItem(null);
  }

  async function toggleExpanded(sequenceId: string) {
    const newExpanded = new Set(expandedSequences);
    const isCurrentlyExpanded = newExpanded.has(sequenceId);

    if (isCurrentlyExpanded) {
      newExpanded.delete(sequenceId);
    } else {
      newExpanded.add(sequenceId);
    }
    setExpandedSequences(newExpanded);
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Email Sequences</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Create ordered email campaigns with automated delays
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className={cn(showInactive && "bg-accent")}>
            {showInactive ? (
              <PowerOff className="h-4 w-4 mr-1 sm:mr-2" />
            ) : (
              <Power className="h-4 w-4 mr-1 sm:mr-2" />
            )}
            <span className="hidden sm:inline">Show Inactive</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Sequence</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full h-10 pl-10 pr-4 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search sequences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sequences Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-card rounded-xl border animate-pulse"
            />
          ))}
        </div>
      ) : filteredSequences.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-muted/10">
          <Mail className="h-12 w-12 mb-4 text-muted-foreground" />
          <p className="text-xl font-medium">No sequences found</p>
          <p className="text-sm text-muted-foreground mt-2">
            {searchQuery
              ? "Try a different search term"
              : "Create your first email sequence"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSequences.map((sequence) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              isExpanded={expandedSequences.has(sequence.id)}
              onToggle={() => toggleExpanded(sequence.id)}
              onEdit={() => {
                setEditingSequence(sequence);
                setFormData({
                  name: sequence.name,
                  description: sequence.description,
                  is_active: sequence.is_active,
                });
                setShowEditModal(true);
              }}
              onDelete={() => setShowDeleteConfirm(sequence)}
              onToggleActive={() => handleToggleActive(sequence)}
              onAddItem={() => {
                setSelectedSequenceForItem(sequence);
                setShowAddItemModal(true);
              }}
              onRemoveItem={(itemId) => handleRemoveItem(sequence.id, itemId)}
              onDragStart={(itemId, index) =>
                handleDragStart(sequence.id, itemId, index)
              }
              onDragOver={handleDragOver}
              onDrop={(e, index) => handleDrop(e, sequence.id, index)}
              onDragEnd={handleDragEnd}
              onPreviewItem={handlePreviewItem}
              onEditItem={handleEditItem}
              draggedItem={draggedItem}
              isTogglingActive={togglingSequenceId === sequence.id}
              removingItemId={removingItemId}
            />
          ))}
        </div>
      )}

      {/* Add Sequence Modal */}
      {showAddModal && (
        <Modal
          title="Create New Sequence"
          onClose={() => setShowAddModal(false)}
          onSave={handleCreateSequence}
          isLoading={isCreatingSequence}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sequence Name</label>
              <input
                className="w-full mt-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Welcome Series"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full mt-1 h-24 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="What is this sequence for?"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Sequence Modal */}
      {showEditModal && editingSequence && (
        <Modal
          title="Edit Sequence"
          onClose={() => {
            setShowEditModal(false);
            setEditingSequence(null);
            setFormData({ name: "", description: "", is_active: true });
          }}
          onSave={handleUpdateSequence}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Sequence Name</label>
              <input
                className="w-full mt-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g., Welcome Series"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="w-full mt-1 h-24 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder="What is this sequence for?"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          title="Delete Sequence"
          onClose={() => setShowDeleteConfirm(null)}
          onSave={handleDeleteSequence}
          saveText="Delete"
          saveClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          isLoading={isDeletingSequence}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong>"{showDeleteConfirm.name}"</strong>?
            </p>
            <p className="text-sm text-destructive">
              This action cannot be undone. All templates in this sequence will
              be removed.
            </p>
          </div>
        </Modal>
      )}

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => {
          setShowAddItemModal(false);
          setSelectedSequenceForItem(null);
        }}
        onAdd={async (templateId, delayDays, sendTime) => {
          return await handleAddItem(templateId, delayDays, sendTime);
        }}
        templates={templates}
        sequenceName={selectedSequenceForItem?.name}
      />

      {/* Preview Item Modal */}
      {previewItem && fullTemplateData && (
        <Modal
          title="Email Template Preview"
          onClose={() => {
            setPreviewItem(null);
            setFullTemplateData(null);
          }}
          onSave={() => {
            setPreviewItem(null);
            setFullTemplateData(null);
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
                      <label className="text-xs font-medium text-muted-foreground">
                        From:
                      </label>
                      <p className="text-sm truncate">sender@example.com</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs font-medium text-muted-foreground">
                        To:
                      </label>
                      <p className="text-sm truncate">recipient@example.com</p>
                    </div>
                  </div>
                </div>
                <div className="pl-11">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-medium text-muted-foreground">
                      Subject:
                    </label>
                    <p className="text-sm font-semibold truncate">
                      {fullTemplateData.subject}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Body - with proper containment */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 max-w-full">
                <div
                  className="email-content prose prose-sm sm:prose-base max-w-none overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: fullTemplateData.html_content,
                  }}
                  style={{
                    lineHeight: "1.6",
                    color: "#334155",
                  }}
                />
              </div>
            </div>

            {/* Email Footer Info */}
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div>
                  <label className="font-medium text-muted-foreground">
                    Delay
                  </label>
                  <p className="mt-1 text-sm">
                    {previewItem.delay_days > 0
                      ? `${previewItem.delay_days}d`
                      : "Same day"}{" "}
                    at {previewItem.send_time || "09:00"}
                  </p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">
                    Position
                  </label>
                  <p className="mt-1 text-sm">{previewItem.position}</p>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">
                    Category
                  </label>
                  <p className="mt-1 text-sm truncate">
                    {fullTemplateData.category || "General"}
                  </p>
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
            .email-content h1,
            .email-content h2,
            .email-content h3 {
              margin-top: 1.5em;
              margin-bottom: 0.75em;
              font-weight: 600;
              word-wrap: break-word;
            }
            .email-content ul,
            .email-content ol {
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
            .email-content strong,
            .email-content b {
              font-weight: 600;
            }
            .email-content em,
            .email-content i {
              font-style: italic;
            }
            .email-content blockquote {
              border-left: 4px solid #e2e8f0;
              padding-left: 1em;
              margin: 1em 0;
              color: #64748b;
            }
            .email-content code {
              background-color: #f1f5f9;
              padding: 0.2em 0.4em;
              border-radius: 4px;
              font-family: monospace;
              font-size: 0.9em;
              word-break: break-all;
            }
            .email-content pre {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 1em;
              overflow-x: auto;
              margin: 1em 0;
              max-width: 100%;
            }
            .email-content img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin: 1em 0;
            }
            .email-content table {
              width: 100%;
              max-width: 100%;
              border-collapse: collapse;
              margin: 1em 0;
              table-layout: auto;
            }
            .email-content th,
            .email-content td {
              border: 1px solid #e2e8f0;
              padding: 0.75em;
              text-align: left;
              word-wrap: break-word;
            }
            .email-content th {
              background-color: #f8fafc;
              font-weight: 600;
            }
            .email-content hr {
              border: none;
              border-top: 2px solid #e2e8f0;
              margin: 2em 0;
            }
            .email-content button,
            .email-content .btn {
              display: inline-block;
              padding: 0.75em 1.5em;
              background-color: #3b82f6;
              color: white;
              border: none;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              text-decoration: none;
              margin: 0.5em 0;
            }
            .email-content button:hover,
            .email-content .btn:hover {
              background-color: #2563eb;
            }
          `}</style>
        </Modal>
      )}

      {/* Edit Item Modal */}
      {editItem && fullTemplateData && (
        <Modal
          title="Edit Email Template"
          onClose={() => {
            setEditItem(null);
            setFullTemplateData(null);
            setCategoryInputType("select");
            setShowSequenceEditModal(false);
            setExpandedAccordion(null);
          }}
          onSave={handleUpdateTemplate}
          size="large"
          isLoading={isUpdatingTemplate}>
          <div className="space-y-4">
            {/* Accordion 1: Template Details */}
            <AccordionItem
              title="Template Details"
              icon={<Info className="h-4 w-4" />}
              description={
                fullTemplateData.name ||
                "Configure template name, category, and subject"
              }
              isExpanded={expandedAccordion === "details"}
              onToggle={() =>
                setExpandedAccordion(
                  expandedAccordion === "details" ? null : "details",
                )
              }>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Template Name</label>
                  <input
                    type="text"
                    className="w-full mt-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={fullTemplateData.name}
                    onChange={(e) =>
                      setFullTemplateData({
                        ...fullTemplateData,
                        name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    {categoryInputType === "select" ? (
                      <div className="flex gap-2 mt-1">
                        <select
                          className="flex-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={fullTemplateData.category || ""}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setCategoryInputType("custom");
                              setFullTemplateData({
                                ...fullTemplateData,
                                category: "",
                              });
                            } else {
                              setFullTemplateData({
                                ...fullTemplateData,
                                category: e.target.value,
                              });
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
                          value={fullTemplateData.category || ""}
                          onChange={(e) =>
                            setFullTemplateData({
                              ...fullTemplateData,
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
                  {fullTemplateData.category && (
                    <div>
                      <label className="text-sm font-medium">
                        Sequence Number
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-10 px-3 bg-muted/50 border rounded-lg flex items-center">
                          <span className="text-sm font-medium">
                            {fullTemplateData.category}{" "}
                            {getSequenceNumber(
                              fullTemplateData.category,
                              fullTemplateData.id,
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
                                fullTemplateData.category,
                                fullTemplateData.id,
                              ),
                            );
                            setShowSequenceEditModal(true);
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
                  <label className="text-sm font-medium">Subject</label>
                  <input
                    type="text"
                    className="w-full mt-1 h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={fullTemplateData.subject}
                    onChange={(e) =>
                      setFullTemplateData({
                        ...fullTemplateData,
                        subject: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </AccordionItem>

            {/* Accordion 2: Email Content */}
            <AccordionItem
              title="Email Content"
              icon={<Edit className="h-4 w-4" />}
              description={
                fullTemplateData.subject ||
                "Write your email content with the visual editor"
              }
              isExpanded={expandedAccordion === "content"}
              onToggle={() =>
                setExpandedAccordion(
                  expandedAccordion === "content" ? null : "content",
                )
              }>
              <RichTextEditor
                value={fullTemplateData.html_content}
                onChange={(value) =>
                  setFullTemplateData({
                    ...fullTemplateData,
                    html_content: value,
                  })
                }
                placeholder="Start writing your email content..."
                minHeight="200px"
              />
            </AccordionItem>

            {/* Accordion 3: Sequence Settings */}
            {editItem && (
              <AccordionItem
                title="Sequence Settings"
                icon={<Clock className="h-4 w-4" />}
                description={`Delay: ${editItemDelayDays}d at ${editItemSendTime}`}
                isExpanded={expandedAccordion === "sequence"}
                onToggle={() =>
                  setExpandedAccordion(
                    expandedAccordion === "sequence" ? null : "sequence",
                  )
                }>
                <div className="bg-muted/30 border border-border/60 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Delay Days */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                        After previous email
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          className="flex-1 h-9 px-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={editItemDelayDays}
                          onChange={(e) =>
                            setEditItemDelayDays(parseInt(e.target.value) || 0)
                          }
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          days
                        </span>
                      </div>
                    </div>

                    {/* Time of Day */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                        Send at time
                      </label>
                      <input
                        type="time"
                        className="w-full h-9 px-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={editItemSendTime}
                        onChange={(e) => setEditItemSendTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </AccordionItem>
            )}

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> This will update the template for all
                sequences using it. The changes will apply immediately.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Sequence Number Edit Modal */}
      {showSequenceEditModal && (
        <Modal
          title={`Edit Sequence Number - ${fullTemplateData?.category || ""}`}
          onClose={() => setShowSequenceEditModal(false)}
          onSave={() => {
            if (fullTemplateData) {
              setFullTemplateData({
                ...fullTemplateData,
                sequence_number: tempSequenceNumber,
              });
            }
            setShowSequenceEditModal(false);
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
                  {fullTemplateData?.category || "Email"} {tempSequenceNumber}
                </strong>
              </p>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>
                  Existing {fullTemplateData?.category || ""} emails:
                </strong>
              </p>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {templates
                  .filter(
                    (t) =>
                      t.category === fullTemplateData?.category &&
                      t.id !== fullTemplateData?.id,
                  )
                  .sort((a, b) => {
                    const aNum =
                      a.name.match(
                        new RegExp(
                          `^${fullTemplateData?.category}\\s*(\\d+)`,
                          "i",
                        ),
                      )?.[1] || "0";
                    const bNum =
                      b.name.match(
                        new RegExp(
                          `^${fullTemplateData?.category}\\s*(\\d+)`,
                          "i",
                        ),
                      )?.[1] || "0";
                    return parseInt(aNum) - parseInt(bNum);
                  })
                  .slice(0, 5)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="text-xs flex items-center justify-between p-2 bg-background rounded">
                      <span>{t.name}</span>
                      <span className="text-muted-foreground">
                        {t.subject || "No subject"}
                      </span>
                    </div>
                  ))}
                {templates.filter(
                  (t) =>
                    t.category === fullTemplateData?.category &&
                    t.id !== fullTemplateData?.id,
                ).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No other emails in this category yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SequenceCard({
  sequence,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onToggleActive,
  onAddItem,
  onRemoveItem,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPreviewItem,
  onEditItem,
  draggedItem,
  isTogglingActive,
  removingItemId,
}: {
  sequence: Sequence;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  onDragStart: (itemId: string, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onPreviewItem: (item: any) => void;
  onEditItem: (itemId: string, item: any) => void;
  draggedItem: { sequenceId: string; itemId: string; index: number } | null;
  isTogglingActive?: boolean;
  removingItemId?: string | null;
}) {
  const totalDelay = (sequence.items || []).reduce((acc, item) => {
    return acc + (item.delay_days || 0);
  }, 0);

  return (
    <Card
      className={cn(
        "group hover:shadow-lg transition-all bg-card/50 overflow-hidden border-border/60",
        !sequence.is_active && "opacity-60",
      )}>
      <CardHeader className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <CardTitle className="text-base font-semibold truncate">
                {sequence.name}
              </CardTitle>
              {!sequence.is_active && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground shrink-0">
                  Inactive
                </span>
              )}
            </div>
            <CardDescription className="text-xs line-clamp-2">
              {sequence.description || "No description"}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggle}>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span>{sequence.items?.length || 0} emails</span>
          </div>
          {totalDelay > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{Math.round(totalDelay)} days total</span>
            </div>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-3 sm:p-4 pt-0 border-t border-border/60">
          <div className="space-y-2 mt-4">
            {!sequence.items || sequence.items.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No emails in this sequence yet
              </div>
            ) : (
              (sequence.items || []).map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => onDragStart(item.id, index)}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, index)}
                  onDragEnd={onDragEnd}
                  className={cn(
                    "relative p-3 pr-12 sm:pr-16 bg-background rounded-lg border border-border/60 group/item hover:border-primary/30 transition-colors cursor-move overflow-hidden",
                    draggedItem?.itemId === item.id && "opacity-50",
                    draggedItem?.sequenceId === sequence.id &&
                      draggedItem?.index !== index &&
                      "border-primary/50",
                  )}>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                      {index < (sequence.items?.length || 0) - 1 && (
                        <div className="w-0.5 h-6 sm:h-8 bg-border" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 cursor-grab active:cursor-grabbing shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.template_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.template_subject}
                            </p>
                            {(item.delay_days > 0 || item.send_time) && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>
                                  {item.delay_days > 0
                                    ? `${item.delay_days}d`
                                    : "Same day"}{" "}
                                  at {item.send_time || "09:00"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons - Always visible on mobile, hover on desktop */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-opacity z-10">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 bg-background/95 backdrop-blur-sm border shadow-sm hover:bg-accent"
                        onClick={() => onPreviewItem(item)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 bg-background/95 backdrop-blur-sm border shadow-sm hover:bg-accent"
                        onClick={() => onEditItem(sequence.id, item)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 bg-background/95 backdrop-blur-sm border shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={removingItemId === item.id}>
                        {removingItemId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 gap-2"
            onClick={onAddItem}>
            <Plus className="h-4 w-4" />
            Add More Templates
          </Button>
        </CardContent>
      )}

      <div className="p-4 pt-0 border-t border-border/60 mt-auto flex items-center justify-between gap-2">
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8",
              sequence.is_active
                ? "text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                : "text-green-500 hover:text-green-600 hover:bg-green-500/10",
            )}
            onClick={onToggleActive}
            disabled={isTogglingActive}>
            {isTogglingActive ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                {sequence.is_active ? "Deactivating..." : "Activating..."}
              </>
            ) : sequence.is_active ? (
              <>
                <PowerOff className="h-3.5 w-3.5 mr-1" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5 mr-1" />
                Activate
              </>
            )}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>
    </Card>
  );
}

function Modal({
  title,
  onClose,
  onSave,
  saveText = "Save",
  saveClassName = "",
  size = "medium",
  isLoading = false,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saveText?: string;
  saveClassName?: string;
  size?: "small" | "medium" | "large" | "xlarge" | "full";
  isLoading?: boolean;
  children: React.ReactNode;
}) {
  const sizeClasses = {
    small: "max-w-sm",
    medium: "max-w-md",
    large: "max-w-2xl",
    xlarge: "max-w-4xl",
    full: "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={cn(
          "bg-card rounded-xl border shadow-lg w-full max-w-[95vw] sm:max-w-lg animate-in fade-in duration-300 zoom-in-95 slide-in-from-top-[5%] flex flex-col mx-auto",
          size === "full" ? "h-[90vh]" : "max-h-[90vh]",
        )}>
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <h3 className="text-base sm:text-lg font-semibold truncate pr-2">{title}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3 sm:p-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 flex-col-reverse sm:flex-row p-3 sm:p-4 border-t shrink-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className={cn("gap-2 w-full sm:w-auto", saveClassName)}
            onClick={onSave}
            disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {saveText}...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {saveText}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
