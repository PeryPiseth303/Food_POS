"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  getAdminMenu,
  toggleMenuItemAvailability,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from "@/lib/api";
import { Category, MenuItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  Sparkles,
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formCategoryId, setFormCategoryId] = useState<number>(1);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDietaryTags, setFormDietaryTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadMenu = async () => {
    try {
      const data = await getAdminMenu();
      setCategories(data);
      if (data.length > 0 && !formCategoryId) {
        setFormCategoryId(data[0].id);
      }
    } catch (err) {
      toast.error("Failed to load menu items");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const updated = await toggleMenuItemAvailability(item.id);
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i) => (i.id === item.id ? { ...i, is_available: updated.is_available } : i))
        }))
      );
      toast.success(
        `'${item.name}' is now ${updated.is_available ? "In Stock" : "Marked Out of Stock"}`
      );
    } catch {
      toast.error("Failed to update availability");
    }
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormPrice("");
    setFormDescription("");
    setFormImageUrl("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80");
    setFormDietaryTags("");
    if (categories.length > 0) setFormCategoryId(categories[0].id);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormCategoryId(item.category_id);
    setFormName(item.name);
    setFormPrice(item.price.toString());
    setFormDescription(item.description || "");
    setFormImageUrl(item.image_url || "");
    setFormDietaryTags(item.dietary_tags || "");
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) {
      toast.error("Name and price are required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        category_id: formCategoryId,
        name: formName,
        price: parseFloat(formPrice),
        description: formDescription,
        image_url: formImageUrl || undefined,
        dietary_tags: formDietaryTags,
        is_available: editingItem ? editingItem.is_available : true,
        sort_order: 0
      };

      if (editingItem) {
        await updateMenuItem(editingItem.id, payload);
        toast.success("Dish updated successfully!");
      } else {
        await createMenuItem(payload);
        toast.success("New dish added to menu!");
      }

      setIsModalOpen(false);
      loadMenu();
    } catch (err: any) {
      toast.error(err.message || "Failed to save dish");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;
    try {
      await deleteMenuItem(itemId);
      toast.success("Dish removed from menu");
      loadMenu();
    } catch {
      toast.error("Failed to delete dish");
    }
  };

  // Flatten & filter items
  const allItems = categories.flatMap((c) =>
    selectedCategory === "all" || selectedCategory === c.id
      ? c.items.map((i) => ({ ...i, categoryName: c.name }))
      : []
  );

  const filteredItems = allItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Menu Manager</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add dishes, modify prices, and instantly toggle out-of-stock items
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Dish</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-card border border-input text-foreground focus:ring-2 focus:ring-orange-500/40"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === "all"
                ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === c.id
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dishes Table / Cards */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-card border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                item.is_available
                  ? "border-border shadow-sm"
                  : "border-rose-300 dark:border-rose-950 bg-rose-50/20 opacity-75"
              }`}
            >
              <div>
                <div className="flex gap-3 items-start">
                  {item.image_url && (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-secondary">
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-bold text-sm text-foreground truncate">{item.name}</h3>
                      <span className="font-black text-sm text-orange-600">
                        {formatCurrency(item.price)}
                      </span>
                    </div>

                    <span className="text-[10px] font-semibold text-muted-foreground block mt-0.5">
                      {item.categoryName}
                    </span>

                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                {/* Instant In-Stock / Out-of-Stock Switch */}
                <button
                  onClick={() => handleToggleAvailability(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    item.is_available
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      item.is_available ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span>{item.is_available ? "In Stock" : "Out of Stock"}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                    title="Edit dish"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    className="p-1.5 rounded-lg bg-secondary hover:bg-rose-100 hover:text-rose-600 text-muted-foreground transition-colors"
                    title="Delete dish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base text-foreground">
                {editingItem ? `Edit Dish: ${editingItem.name}` : "Add New Dish"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-foreground">Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-foreground">Dish Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Wagyu Truffle Burger"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-foreground">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="18.50"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ingredients and culinary notes..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">Image URL</label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Dietary Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formDietaryTags}
                  onChange={(e) => setFormDietaryTags(e.target.value)}
                  placeholder="e.g. spicy,vegetarian,gluten-free"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Dish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
