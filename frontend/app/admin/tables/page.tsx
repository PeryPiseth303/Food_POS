"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getTables, createTable, getTableQr } from "@/lib/api";
import { TableData } from "@/lib/types";
import {
  QrCode,
  Plus,
  Printer,
  ExternalLink,
  Users,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  Utensils
} from "lucide-react";
import { toast } from "sonner";

export default function AdminTablesPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Print / View QR modal
  const [selectedTableForQr, setSelectedTableForQr] = useState<TableData | null>(null);
  const [qrDetails, setQrDetails] = useState<{ qr_image_base64: string; target_url: string } | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Add Table Modal
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newCapacity, setNewCapacity] = useState(4);
  const [isSavingTable, setIsSavingTable] = useState(false);

  const loadTables = async () => {
    try {
      const data = await getTables();
      setTables(data);
    } catch {
      toast.error("Failed to load tables");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleOpenQrModal = async (table: TableData) => {
    setSelectedTableForQr(table);
    setIsLoadingQr(true);
    try {
      const qr = await getTableQr(table.id);
      setQrDetails(qr);
    } catch {
      toast.error("Failed to generate QR code");
    } finally {
      setIsLoadingQr(false);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    setIsSavingTable(true);
    try {
      await createTable(newTableNumber.trim(), newCapacity);
      toast.success(`Table #${newTableNumber} created successfully!`);
      setIsAddTableOpen(false);
      setNewTableNumber("");
      loadTables();
    } catch (err: any) {
      toast.error(err.message || "Failed to create table");
    } finally {
      setIsSavingTable(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-3.5 sm:p-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Dining Tables & QR Codes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage restaurant dining tables and generate high-resolution QR stands ready for printing
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddTableOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-500/25 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Table</span>
        </button>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-2" />
          <p className="text-xs text-muted-foreground font-semibold">Loading tables...</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground max-w-sm mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
            <QrCode className="w-7 h-7 opacity-40 text-foreground" />
          </div>
          <p className="font-extrabold text-sm text-foreground">No tables configured</p>
          <p className="text-xs mt-1 text-muted-foreground">Click "Add New Table" above to create your first dining table.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="modern-card rounded-2xl sm:rounded-3xl p-4 flex flex-col justify-between items-center text-center transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600/15 to-amber-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-black text-base shadow-2xs">
                #{table.table_number}
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Table {table.table_number}
                </h3>
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <Users className="w-3.5 h-3.5 opacity-60" />
                  <span>Seats {table.capacity}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenQrModal(table)}
                className="w-full py-2 px-3 rounded-xl bg-secondary hover:bg-orange-600 hover:text-white text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-95"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>View QR</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Printable QR Code Modal */}
      {selectedTableForQr && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card text-foreground w-full max-w-sm rounded-3xl shadow-2xl p-5 sm:p-6 text-center space-y-4 border border-border/80 print:m-0 print:p-0 print:border-none animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/70 pb-3 print:hidden">
              <span className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground">
                Table Stand QR Code
              </span>
              <button
                type="button"
                onClick={() => setSelectedTableForQr(null)}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Card Area */}
            <div className="bg-gradient-to-b from-orange-500/5 to-amber-500/10 border-2 border-orange-500/30 rounded-3xl p-5 sm:p-6 space-y-3.5 shadow-sm">
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Utensils className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-black text-lg sm:text-xl text-foreground tracking-tight">
                    Bistro Moderne
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">Scan to View Menu & Order Dishes</p>
              </div>

              <div className="p-3 bg-white rounded-2xl shadow-inner inline-block mx-auto border border-stone-200">
                {isLoadingQr ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
                  </div>
                ) : qrDetails ? (
                  <img
                    src={qrDetails.qr_image_base64}
                    alt={`QR Code Table ${selectedTableForQr.table_number}`}
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground">
                    Failed to load QR
                  </div>
                )}
              </div>

              <div>
                <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black text-sm shadow-md shadow-orange-500/25">
                  TABLE #{selectedTableForQr.table_number}
                </span>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Point smartphone camera at QR • No app required
                </p>
              </div>
            </div>

            {/* Action Buttons (Hidden in print) */}
            <div className="pt-2 flex flex-col gap-2 print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Table QR Stand</span>
              </button>

              {qrDetails && (
                <a
                  href={qrDetails.target_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-border/70"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Scanned URL in New Tab</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {isAddTableOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-border/80 shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">Add New Dining Table</h3>
              <button
                type="button"
                onClick={() => setIsAddTableOpen(false)}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Table Number or Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15, Patio-2, VIP-1"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(parseInt(e.target.value) || 2)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-border/70 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTable}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold flex items-center gap-1.5 shadow-md shadow-orange-500/25 transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isSavingTable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
                  <span>Create Table</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
