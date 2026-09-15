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
  Sparkles
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
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Restaurant Tables & QR Codes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage dining tables and generate high-resolution QR codes ready for printing
          </p>
        </div>

        <button
          onClick={() => setIsAddTableOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Table</span>
        </button>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="bg-card border border-border/80 hover:border-orange-500/50 rounded-2xl p-4 flex flex-col justify-between items-center text-center shadow-sm hover:shadow-md transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/80 text-orange-600 flex items-center justify-center font-black text-base shadow-sm">
                #{table.table_number}
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Table {table.table_number}
                </h3>
                <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                  <Users className="w-3 h-3" />
                  <span>Seats {table.capacity}</span>
                </div>
              </div>

              <button
                onClick={() => handleOpenQrModal(table)}
                className="w-full py-2 px-3 rounded-xl bg-secondary hover:bg-orange-600 hover:text-white text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
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
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white text-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center space-y-4 border border-stone-200 print:m-0 print:p-0 print:border-none">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <span className="font-bold text-xs uppercase tracking-wider text-stone-500">
                Table QR Generator
              </span>
              <button
                onClick={() => setSelectedTableForQr(null)}
                className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 hover:bg-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Card Area */}
            <div className="bg-orange-50/70 border-2 border-orange-500/30 rounded-2xl p-6 space-y-4 shadow-sm">
              <div>
                <h3 className="font-black text-xl text-stone-900 tracking-tight">
                  Bistro Moderne
                </h3>
                <p className="text-xs text-stone-500">Scan to View Menu & Order Food</p>
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
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-stone-400">
                    Failed to load QR
                  </div>
                )}
              </div>

              <div>
                <span className="inline-block px-4 py-1.5 rounded-full bg-orange-600 text-white font-extrabold text-sm shadow">
                  TABLE #{selectedTableForQr.table_number}
                </span>
                <p className="text-[11px] text-stone-500 mt-2">
                  Point camera at QR • No app required
                </p>
              </div>
            </div>

            {/* Action Buttons (Hidden in print) */}
            <div className="pt-2 flex flex-col gap-2 print:hidden">
              <button
                onClick={handlePrint}
                className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Table QR Stand</span>
              </button>

              {qrDetails && (
                <a
                  href={qrDetails.target_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5"
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
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground">Add New Dining Table</h3>
              <button
                onClick={() => setIsAddTableOpen(false)}
                className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-3 text-xs">
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
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-foreground">
                  Seating Capacity (Guests)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTableOpen(false)}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTable}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isSavingTable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
