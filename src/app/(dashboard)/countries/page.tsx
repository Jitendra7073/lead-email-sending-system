"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Globe,
  Edit,
  Trash2,
  Clock,
  Calendar,
  Power,
  PowerOff,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { COUNTRY_TIMEZONES } from "@/lib/data/country-timezones"

interface Country {
  id: string
  country_code: string
  country_name: string
  default_timezone: string
  business_hours_start: string
  business_hours_end: string
  weekend_days: string[]
  region?: string
  utc_offset: string | null
  dst_observed: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
]

// Get all unique timezones from the data file
const COMMON_TIMEZONES = Array.from(new Set(COUNTRY_TIMEZONES.map(c => c.default_timezone))).sort()

export default function CountriesPage() {
  const [countries, setCountries] = React.useState<Country[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Dialog states
  const [showAddDialog, setShowAddDialog] = React.useState(false)
  const [showEditDialog, setShowEditDialog] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [selectedCountry, setSelectedCountry] = React.useState<Country | null>(null)

  // Form states
  const [formData, setFormData] = React.useState({
    country_code: "",
    country_name: "",
    default_timezone: "",
    business_hours_start: "09:00",
    business_hours_end: "17:00",
    weekend_days: ["Saturday", "Sunday"],
    region: "",
    is_active: true
  })

  // Action loading states
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  React.useEffect(() => {
    fetchCountries()
  }, [])

  async function fetchCountries() {
    try {
      const res = await fetch("/api/countries")
      const json = await res.json()
      if (json.success) {
        setCountries(json.data)
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to fetch countries")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = showEditDialog ? `/api/countries/${selectedCountry?.id}` : "/api/countries"
      const method = showEditDialog ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      const json = await res.json()

      if (json.success) {
        toast.success(json.message || `Country ${showEditDialog ? "updated" : "created"} successfully`)
        setShowAddDialog(false)
        setShowEditDialog(false)
        setSelectedCountry(null)
        resetForm()
        fetchCountries()
      } else {
        toast.error(json.error || "Operation failed")
      }
    } catch (err) {
      toast.error("Network error")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!selectedCountry) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/countries/${selectedCountry.id}`, {
        method: "DELETE"
      })

      const json = await res.json()

      if (json.success) {
        toast.success("Country deleted successfully")
        setShowDeleteDialog(false)
        setSelectedCountry(null)
        fetchCountries()
      } else {
        toast.error(json.error || "Failed to delete country")
      }
    } catch (err) {
      toast.error("Network error")
    } finally {
      setIsDeleting(false)
    }
  }

  function resetForm() {
    setFormData({
      country_code: "",
      country_name: "",
      default_timezone: "",
      business_hours_start: "09:00",
      business_hours_end: "17:00",
      weekend_days: ["Saturday", "Sunday"],
      region: "",
      is_active: true
    })
  }

  function openEditDialog(country: Country) {
    setSelectedCountry(country)
    setFormData({
      country_code: country.country_code,
      country_name: country.country_name,
      default_timezone: country.default_timezone,
      business_hours_start: country.business_hours_start,
      business_hours_end: country.business_hours_end,
      weekend_days: country.weekend_days,
      region: country.region || "",
      is_active: country.is_active
    })
    setShowEditDialog(true)
  }

  function toggleWeekend(day: string) {
    setFormData(prev => ({
      ...prev,
      weekend_days: prev.weekend_days.includes(day)
        ? prev.weekend_days.filter(d => d !== day)
        : [...prev.weekend_days, day]
    }))
  }

  function autoFillFromCountryCode(code: string) {
    const upperCode = code.toUpperCase()
    const preset = COUNTRY_TIMEZONES.find(c => c.country_code === upperCode)
    if (preset) {
      setFormData(prev => ({
        ...prev,
        country_name: preset.country_name,
        default_timezone: preset.default_timezone,
        business_hours_start: preset.business_hours_start,
        business_hours_end: preset.business_hours_end,
        weekend_days: preset.weekend_days,
        region: (preset as any).region || ""
      }))
      toast.success(`Auto-filled data for ${preset.country_name}`)
    }
  }

  function handleCountryCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.toUpperCase()
    setFormData(prev => ({ ...prev, country_code: value }))
    // Auto-fill when code is complete (2 characters)
    if (value.length === 2) {
      autoFillFromCountryCode(value)
    }
  }

  const filteredCountries = countries.filter(c =>
    c.country_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country_code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Countries</h2>
          <p className="text-muted-foreground">
            Manage timezone and business hours configuration for {countries.length} countries
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true) }} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Country
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full h-10 pl-10 pr-4 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search by country name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Showing {filteredCountries.length} of {countries.length} countries</span>
        </div>
      </div>

      {/* Countries Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 bg-card rounded-xl border animate-pulse" />
          ))}
        </div>
      ) : filteredCountries.length === 0 ? (
        <Card className="p-12 text-center">
          <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? "No countries found" : "No countries configured"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? "Try a different search term"
              : "Add your first country to get started with timezone-aware scheduling"}
          </p>
          {!searchQuery && (
            <Button onClick={() => { resetForm(); setShowAddDialog(true) }} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Country
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCountries.map((country) => (
            <CountryCard
              key={country.id}
              country={country}
              onEdit={() => openEditDialog(country)}
              onDelete={() => {
                setSelectedCountry(country)
                setShowDeleteDialog(true)
              }}
              onToggleActive={() => {
                setSelectedCountry(country)
                fetch(`/api/countries/${country.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ is_active: !country.is_active })
                }).then(() => fetchCountries())
              }}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false)
          setShowEditDialog(false)
          setSelectedCountry(null)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditDialog ? "Edit Country" : "Add New Country"}
            </DialogTitle>
            <DialogDescription>
              Configure timezone and business hours for this country
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Quick select for add mode */}
            {!showEditDialog && (
              <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                <label className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4" />
                  Quick Select from Presets
                </label>
                <select
                  className="w-full h-10 px-3 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      const preset = COUNTRY_TIMEZONES.find(c => c.country_code === e.target.value)
                      if (preset) {
                        setFormData({
                          country_code: preset.country_code,
                          country_name: preset.country_name,
                          default_timezone: preset.default_timezone,
                          business_hours_start: preset.business_hours_start,
                          business_hours_end: preset.business_hours_end,
                          weekend_days: preset.weekend_days,
                          region: (preset as any).region || "",
                          is_active: true
                        })
                        toast.success(`Loaded ${preset.country_name}`)
                      }
                    }
                  }}
                >
                  <option value="">-- Select a country to auto-fill --</option>
                  {COUNTRY_TIMEZONES
                    .filter(c => !countries.find(db => db.country_code === c.country_code))
                    .map(c => (
                      <option key={c.country_code} value={c.country_code}>
                        {c.country_name} ({c.country_code})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Main Form - Two Column Layout */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              {/* Left Column */}
              <div className="space-y-5">
                {/* Country Code */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country Code</label>
                  <input
                    required
                    maxLength={2}
                    className="w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                    placeholder="US"
                    value={formData.country_code}
                    onChange={handleCountryCodeChange}
                    disabled={showEditDialog}
                  />
                </div>

                {/* Country Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country Name</label>
                  <input
                    required
                    className="w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="United States"
                    value={formData.country_name}
                    onChange={(e) => setFormData({ ...formData, country_name: e.target.value })}
                  />
                </div>

                {/* Region */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Region</label>
                  <input
                    className="w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="e.g., North America"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  />
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <select
                    required
                    className="w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.default_timezone}
                    onChange={(e) => setFormData({ ...formData, default_timezone: e.target.value })}
                  >
                    <option value="">Select timezone...</option>
                    {COMMON_TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                {/* Business Hours */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Business Hours
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Start</label>
                      <input
                        type="time"
                        required
                        className="w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.business_hours_start}
                        onChange={(e) => setFormData({ ...formData, business_hours_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">End</label>
                      <input
                        type="time"
                        required
                        className="w-full h-10 px-3 bg-card border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={formData.business_hours_end}
                        onChange={(e) => setFormData({ ...formData, business_hours_end: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Weekend Days */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Weekend Days
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {WEEKDAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekend(day)}
                        className={cn(
                          "px-2 py-2 text-xs font-medium rounded-lg border transition-colors text-center",
                          formData.weekend_days.includes(day)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="is_active" className="text-sm cursor-pointer">
                      Active
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false)
                  setShowEditDialog(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  showEditDialog ? "Update Country" : "Add Country"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Country</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedCountry?.country_name}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Country Card Component
function CountryCard({ country, onEdit, onDelete, onToggleActive }: {
  country: Country
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}) {
  const [isToggling, setIsToggling] = React.useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      await onToggleActive()
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <Card className={cn(
      "group overflow-hidden transition-all duration-200 hover:shadow-lg",
      !country.is_active && "opacity-60"
    )}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {country.country_code.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{country.country_name}</h3>
              <p className="text-xs text-muted-foreground">{country.country_code}</p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all",
              country.is_active
                ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {isToggling ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : country.is_active ? (
              <Power className="h-3 w-3" />
            ) : (
              <PowerOff className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Region Badge */}
        {country.region && (
          <div className="mb-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border/50">
              {country.region}
            </span>
          </div>
        )}

        {/* Details Grid */}
        <div className="space-y-3 text-sm">
          {/* Timezone */}
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{country.default_timezone}</span>
          </div>

          {/* Business Hours */}
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {country.business_hours_start} - {country.business_hours_end}
            </span>
          </div>

          {/* Weekend Days */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex gap-1">
              {country.weekend_days.filter(day => day.trim().length > 0).map(day => (
                <span
                  key={day}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground"
                >
                  {day.trim().slice(0, 3)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onEdit}
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
