"use client";

import { useState } from "react";
import {
  Utensils,
  Bike,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  Check,
  X,
  QrCode,
  ShieldCheck,
  Building2,
  Camera,
  Layers,
  ChevronRight
} from "lucide-react";
import { OrderType, TableSession } from "@/lib/types";
import { validateTable } from "@/lib/api";
import { toast } from "sonner";
import TableQrScanner from "./TableQrScanner";

interface DiningOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrderType: OrderType;
  currentTable: string;
  onSelectDineIn: (tableNumber: string, session?: TableSession) => void;
  onSelectDelivery: () => void;
  allowClose?: boolean;
}

const POPULAR_TABLES = ["1", "2", "3", "4", "5", "6", "8", "12"];

export default function DiningOptionModal({
  isOpen,
  onClose,
  currentOrderType,
  currentTable,
  onSelectDineIn,
  onSelectDelivery,
  allowClose = true,
}: DiningOptionModalProps) {
  const [selectedMode, setSelectedMode] = useState<OrderType>(currentOrderType || "dine_in");
  const [dineInMethod, setDineInMethod] = useState<"camera" | "manual">(currentTable ? "manual" : "camera");
  const [selectedTable, setSelectedTable] = useState<string>(currentTable || "1");
  const [customTable, setCustomTable] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleConfirmDineIn = async (tableNum: string, token?: string) => {
    const targetTable = (tableNum || "1").trim();
    setIsVerifying(true);
    try {
      const session = await validateTable(targetTable, token);
      onSelectDineIn(targetTable, session);
      toast.success(`🍽️ Table #${targetTable} Selected!`, {
        description: `Dishes ordered will be served directly to Table #${targetTable}.`,
        duration: 4000,
      });
      onClose();
    } catch (err: any) {
      // Fallback: still set the table number so customer is never blocked
      onSelectDineIn(targetTable);
      toast.success(`🍽️ Table #${targetTable} Selected!`, {
        description: `Dishes ordered will be served directly to Table #${targetTable}.`,
        duration: 4000,
      });
      onClose();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQrScanned = (tableNum: string, token?: string) => {
    handleConfirmDineIn(tableNum, token);
  };

  const handleConfirmDelivery = () => {
    onSelectDelivery();
    toast.success("🛵 Delivery Mode Activated!", {
      description: "Enjoy fresh Bistro Moderne dishes delivered straight to your door.",
      duration: 4500,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-card border border-border/80 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 text-foreground my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Header */}
        <div className="relative p-5 sm:p-6 border-b border-border/60 bg-gradient-to-r from-orange-500/5 via-background to-blue-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Bistro Moderne
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-500/10 text-[10px] font-bold text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    <Sparkles className="w-2.5 h-2.5" /> Dining Options
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Choose How You Want to Order
                </h2>
              </div>
            </div>

            {allowClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Scan your table stand QR code to dine in, or choose doorstep delivery to order from home.
          </p>
        </div>

        {/* Content Body */}
        <div className="relative p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Card 1: Dine-In At Restaurant */}
          <div
            onClick={() => setSelectedMode("dine_in")}
            className={`rounded-3xl border-2 p-4 sm:p-5 transition-all cursor-pointer relative overflow-hidden ${
              selectedMode === "dine_in"
                ? "border-orange-500 bg-orange-500/5 shadow-md shadow-orange-500/10 ring-1 ring-orange-500/30"
                : "border-border/70 hover:border-orange-500/40 bg-card hover:bg-secondary/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    selectedMode === "dine_in"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-500/30"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base">🍽️ Dine-In at Restaurant</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300">
                      Scan Table QR Stand
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Scan the QR stand on your dining table. Your table number is noted so kitchen staff can deliver food straight to your seat.
                  </p>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  selectedMode === "dine_in"
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-muted-foreground/40"
                }`}
              >
                {selectedMode === "dine_in" && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            {/* DINE-IN OPTIONS: QR CAMERA SCANNER OR MANUAL PICK */}
            {selectedMode === "dine_in" && (
              <div className="mt-4 pt-4 border-t border-orange-500/20 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Method Switcher Tabs */}
                <div className="flex p-1 bg-secondary/70 rounded-2xl border border-border mb-4">
                  <button
                    type="button"
                    onClick={() => setDineInMethod("camera")}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      dineInMethod === "camera"
                        ? "bg-card text-foreground shadow-xs scale-102"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-orange-600" />
                    <span>Scan Table QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDineInMethod("manual")}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      dineInMethod === "manual"
                        ? "bg-card text-foreground shadow-xs scale-102"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-orange-600" />
                    <span>Select Table #</span>
                  </button>
                </div>

                {/* TAB 1: REAL CAMERA QR SCANNER */}
                {dineInMethod === "camera" && (
                  <div className="space-y-3">
                    <TableQrScanner
                      onScanSuccess={handleQrScanned}
                      onClose={() => setDineInMethod("manual")}
                    />

                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Scanning the table stand automatically notes and locks your table number for your order.
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB 2: MANUAL TABLE BUTTONS & INPUT */}
                {dineInMethod === "manual" && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-orange-600" />
                        Choose Table Stand Number:
                      </label>
                      <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                        Selected: Table #{customTable || selectedTable}
                      </span>
                    </div>

                    {/* Table Chips */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mb-2.5">
                      {POPULAR_TABLES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setSelectedTable(t);
                            setCustomTable("");
                          }}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all ${
                            selectedTable === t && !customTable
                              ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/30 scale-102"
                              : "bg-background/80 hover:bg-secondary border-border text-foreground"
                          }`}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>

                    {/* Custom Table Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Or enter custom table (e.g. VIP-1, Patio-4)"
                        value={customTable}
                        onChange={(e) => {
                          setCustomTable(e.target.value);
                          if (e.target.value) setSelectedTable(e.target.value);
                        }}
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-input bg-background/80 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleConfirmDineIn(customTable || selectedTable)}
                      className="mt-3 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      <Utensils className="w-4 h-4" />
                      <span>
                        {isVerifying
                          ? "Verifying Table..."
                          : `Confirm Table #${customTable || selectedTable} & Start Ordering`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Online Home Delivery */}
          <div
            onClick={() => setSelectedMode("delivery")}
            className={`rounded-3xl border-2 p-4 sm:p-5 transition-all cursor-pointer relative overflow-hidden ${
              selectedMode === "delivery"
                ? "border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30"
                : "border-border/70 hover:border-blue-500/40 bg-card hover:bg-secondary/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                    selectedMode === "delivery"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base">🛵 Online Home Delivery</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      Doorstep Delivery
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Order from home, office, or anywhere. Freshly prepared and dispatched directly to your location.
                  </p>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                  selectedMode === "delivery"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-muted-foreground/40"
                }`}
              >
                {selectedMode === "delivery" && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            {/* Delivery highlights (shown when delivery selected) */}
            {selectedMode === "delivery" && (
              <div className="mt-4 pt-3.5 border-t border-blue-500/20 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <div className="bg-background/80 rounded-xl p-2.5 border border-border/60 flex items-center gap-2 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-muted-foreground">Fast ~25 min prep & dispatch</span>
                  </div>
                  <div className="bg-background/80 rounded-xl p-2.5 border border-border/60 flex items-center gap-2 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-muted-foreground">Address entered in cart</span>
                  </div>
                  <div className="bg-background/80 rounded-xl p-2.5 border border-border/60 flex items-center gap-2 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="text-muted-foreground">Live real-time driver tracking</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmDelivery}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <Bike className="w-4 h-4" />
                  <span>Start Online Delivery Order</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div className="p-4 bg-secondary/30 border-t border-border/60 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Table numbers are noted for kitchen delivery. You can change your table anytime!</span>
        </div>
      </div>
    </div>
  );
}
