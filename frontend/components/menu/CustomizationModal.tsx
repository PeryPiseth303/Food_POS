"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { MenuItem, CustomizationChoice } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { X, Plus, Minus, Flame, Check, Sparkles, Utensils, MessageSquare } from "lucide-react";

interface CustomizationModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number, customizations: any, notes: string) => void;
}

export default function CustomizationModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
}: CustomizationModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  // Customization groups
  const customizationGroups = item.customizations || [];

  const handleSingleSelect = (groupId: string, optionName: string) => {
    setSelectedOptions((prev) => ({ ...prev, [groupId]: optionName }));
  };

  const handleMultiSelect = (groupId: string, option: CustomizationChoice) => {
    setSelectedOptions((prev) => {
      const currentList: CustomizationChoice[] = prev[groupId] || [];
      const exists = currentList.some((o) => o.name === option.name);
      let updated: CustomizationChoice[];
      if (exists) {
        updated = currentList.filter((o) => o.name !== option.name);
      } else {
        updated = [...currentList, option];
      }
      return { ...prev, [groupId]: updated };
    });
  };

  // Calculate unit price including paid options
  const unitPrice = useMemo(() => {
    let price = Number(item.price);
    Object.values(selectedOptions).forEach((val) => {
      if (Array.isArray(val)) {
        val.forEach((opt: any) => {
          if (opt && opt.price) price += Number(opt.price);
        });
      }
    });
    return price;
  }, [item.price, selectedOptions]);

  const totalPrice = unitPrice * quantity;

  const handleSubmit = () => {
    onAddToCart(item, quantity, selectedOptions, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-border/80 overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center bg-card">
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header & Image */}
        <div className="relative h-44 sm:h-56 w-full bg-stone-100 dark:bg-stone-900 shrink-0">
          {item.image_url ? (
            <>
              <Image
                src={item.image_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 520px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-secondary/80">
              <Utensils className="w-8 h-8 opacity-40 mb-1" />
              <span className="text-xs">Bistro Moderne Dish</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors backdrop-blur-md shadow-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                {item.name}
              </h2>
              <span className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400 shrink-0">
                {formatCurrency(item.price)}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Customization Options */}
          {customizationGroups.map((group) => {
            const isSingle = group.type === "single";
            const currentSelected = selectedOptions[group.id];

            return (
              <div key={group.id} className="pt-3.5 border-t border-border/70">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                    {group.name}
                    {group.required && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-extrabold">
                        Required
                      </span>
                    )}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {isSingle ? "Select 1" : "Optional additions"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.options.map((option, idx) => {
                    const isObj = typeof option === "object" && option !== null;
                    const optName = isObj ? (option as CustomizationChoice).name : (option as string);
                    const optPrice = isObj ? (option as CustomizationChoice).price : 0;

                    let isChecked = false;
                    if (isSingle) {
                      isChecked = currentSelected === optName;
                    } else {
                      const list: CustomizationChoice[] = currentSelected || [];
                      isChecked = list.some((o) => o.name === optName);
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSingle) {
                            handleSingleSelect(group.id, optName);
                          } else {
                            handleMultiSelect(group.id, { name: optName, price: optPrice || 0 });
                          }
                        }}
                        className={`px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          isChecked
                            ? "bg-orange-500/10 border-orange-500 text-orange-950 dark:text-orange-200 ring-1 ring-orange-500/40 shadow-xs"
                            : "bg-secondary/40 border-border/80 hover:bg-secondary/80 text-foreground"
                        }`}
                      >
                        <span className="text-xs font-semibold">{optName}</span>
                        <div className="flex items-center gap-2">
                          {optPrice && optPrice > 0 ? (
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                              +{formatCurrency(optPrice)}
                            </span>
                          ) : null}
                          {isChecked && (
                            <div className="w-4 h-4 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Kitchen Notes */}
          <div className="pt-3.5 border-t border-border/70">
            <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              Special Instructions for Kitchen (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Extra sauce, no onions, gluten sensitivity..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
            />
          </div>
        </div>

        {/* Footer with Quantity & Add Button */}
        <div className="p-4 sm:p-5 border-t border-border/80 bg-card/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 pb-safe">
          <div className="flex items-center border border-border/80 rounded-2xl bg-secondary/50 p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground hover:bg-card disabled:opacity-30 transition-all active:scale-90"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center text-sm font-extrabold">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-foreground hover:bg-card transition-all active:scale-90"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            className="flex-1 py-3 px-4 sm:px-5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-between shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all"
          >
            <span>Add to Order</span>
            <span>{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
