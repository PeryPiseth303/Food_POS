"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  Upload,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  QrCode,
  ShieldCheck
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface TableQrScannerProps {
  onScanSuccess: (tableNumber: string, token?: string) => void;
  onClose: () => void;
}

export default function TableQrScanner({ onScanSuccess, onClose }: TableQrScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerId = "interactive-table-qr-reader";

  // Parse QR content to extract table number & token
  const parseQrData = useCallback((decodedText: string) => {
    let tableNum = "";
    let token = "";

    try {
      // Check if decodedText is a URL like http://localhost:3000/menu?table=3&token=xyz
      if (decodedText.startsWith("http://") || decodedText.startsWith("https://") || decodedText.includes("?")) {
        const url = new URL(decodedText.startsWith("http") ? decodedText : `http://dummy.com/${decodedText}`);
        tableNum = url.searchParams.get("table") || "";
        token = url.searchParams.get("token") || "";
      }
    } catch {
      // fallback if not a strict valid URL
    }

    // If still empty, check regex patterns like table=3 or table: 3
    if (!tableNum) {
      const match = decodedText.match(/(?:table[=:\s#]+)(\w+)/i);
      if (match) {
        tableNum = match[1];
      }
    }

    // If it's just a number or clean word (e.g. "3" or "VIP-1")
    if (!tableNum && decodedText.trim().length <= 10) {
      tableNum = decodedText.trim();
    }

    // Default to extracted or raw
    return {
      tableNumber: tableNum || "1",
      token: token || undefined,
    };
  }, []);

  const handleDetected = useCallback(async (decodedText: string) => {
    setScannedResult(decodedText);
    // Play cheerful audio chime if possible
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {}

    // Stop scanner
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }

    const { tableNumber, token } = parseQrData(decodedText);
    setTimeout(() => {
      onScanSuccess(tableNumber, token);
    }, 400);
  }, [onScanSuccess, parseQrData]);

  // Start Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsScanning(false);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      // If already running, stop first
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      await scannerRef.current.start(
        { facingMode: facingMode },
        {
          fps: 15,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDetected(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.warn("Camera start failed:", err);
      setCameraError(
        err.message ||
        "Could not access camera. Please allow camera permissions or upload a QR image below."
      );
      setIsScanning(false);
    }
  }, [facingMode, handleDetected]);

  // Handle camera switch
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Handle image upload scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      const result = await scannerRef.current.scanFile(file, true);
      handleDetected(result);
    } catch (err: any) {
      setCameraError("No valid table QR code found in this image. Please try another photo.");
    }
  };

  // Mount effect
  useEffect(() => {
    startCamera();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          try {
            scannerRef.current?.clear();
          } catch {}
        });
      }
    };
  }, [facingMode, startCamera]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Viewfinder Container */}
      <div className="relative w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden bg-stone-950 border-2 border-orange-500/60 shadow-xl shadow-orange-500/10">
        {/* HTML5 QR reader element */}
        <div id={containerId} className="w-full h-full object-cover" />

        {/* Viewfinder Overlay / Guide */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Corner targeting guides */}
          <div className="w-56 h-56 relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl" />

            {/* Glowing animated laser scan line */}
            {isScanning && !scannedResult && (
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_12px_#f97316] animate-[scanLaser_2.2s_ease-in-out_infinite]" />
            )}
          </div>
        </div>

        {/* Success Splash */}
        {scannedResult && (
          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-white animate-in zoom-in-90 duration-150">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
            <span className="font-extrabold text-sm">QR Code Verified!</span>
            <span className="text-xs text-emerald-200 mt-1">Noting table for order...</span>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center text-white">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
            <span className="font-bold text-xs text-stone-200">{cameraError}</span>
            <button
              type="button"
              onClick={startCamera}
              className="mt-3 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
            </button>
          </div>
        )}
      </div>

      {/* Camera Controls & File Upload */}
      <div className="mt-3.5 flex items-center justify-center gap-2 w-full max-w-[320px]">
        <button
          type="button"
          onClick={toggleFacingMode}
          className="flex-1 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
          <span>Flip Camera</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-blue-600" />
          <span>Upload QR</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-2.5 max-w-xs">
        Point your camera at the QR code stand on your table. It will automatically scan and note your table for food orders.
      </p>
    </div>
  );
}
