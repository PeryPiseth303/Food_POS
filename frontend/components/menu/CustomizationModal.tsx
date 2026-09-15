"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { MenuItem, CustomizationChoice } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { X, Plus, Minus, Flame, Check } from "lucide-react";

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

  // Set default options on first load
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-border overflow-hidden">
        {/* Header & Image */}
        <div className="relative h-48 sm:h-56 w-full bg-stone-100 dark:bg-stone-900 shrink-0">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 500px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No photo available
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground">{item.name}</h2>
              <span className="text-lg font-extrabold text-orange-600 dark:text-orange-400">
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
              <div key={group.id} className="pt-3 border-t border-border/70">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    {group.name}
                    {group.required && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-600 font-medium">
                        Required
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {isSingle ? "Select 1" : "Optional extras"}
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
                        className={`px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isChecked
                            ? "bg-orange-50 border-orange-500/80 text-orange-900 dark:bg-orange-950/40 dark:border-orange-500 dark:text-orange-200"
                            : "bg-secondary/40 border-border hover:bg-secondary/80 text-foreground"
                        }`}
                      >
                        <span className="text-xs font-medium">{optName}</span>
                        <div className="flex items-center gap-2">
                          {optPrice && optPrice > 0 ? (
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                              +{formatCurrency(optPrice)}
                            </span>
                          ) : null}
                          {isChecked && (
                            <Check className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
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
          <div className="pt-3 border-t border-border/70">
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Special Instructions for Kitchen (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Dressing on the side, allergies, extra crispy"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />
          </div>
        </div>

        {/* Footer with Quantity & Add Button */}
        <div className="p-4 border-t border-border bg-card/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center border border-border rounded-xl bg-secondary/50 p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground hover:bg-background disabled:opacity-30 transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-bold">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground hover:bg-background transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleSubmit}
            className="flex-1 py-3 px-5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-between shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all"
          >
            <span>Add to Order</span>
            <span>{formatCurrency(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
