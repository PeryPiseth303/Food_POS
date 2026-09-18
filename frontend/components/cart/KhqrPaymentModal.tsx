"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  QrCode,
  ExternalLink,
  Check,
  RefreshCw,
  Clock,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { createKhqrPayment, checkPaymentStatus } from "@/lib/api";
import { KhqrPaymentData } from "@/lib/types";

interface KhqrPaymentModalProps {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (orderId: number) => void;
}

export const KhqrPaymentModal: React.FC<KhqrPaymentModalProps> = ({
  orderId,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const [paymentData, setPaymentData] = useState<KhqrPaymentData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isPaidRef = useRef<boolean>(false);

  const handleSuccess = () => {
    if (isPaidRef.current) return;
    isPaidRef.current = true;
    setIsPaid(true);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }

    toast.success("🎉 Payment Received via ABA PayWay!", {
      description: "Order confirmed! Your receipt has been issued and the kitchen is preparing your order.",
      duration: 5000,
    });

    // Auto-close modal and advance to tracking after short visual confirmation
    setTimeout(() => {
      onPaymentSuccess(orderId);
      onClose();
    }, 1200);
  };

  // 1. Fetch authentic ABA PayWay checkout details on open
  useEffect(() => {
    if (!isOpen || !orderId) return;

    let mounted = true;
    setIsLoading(true);
    setIsPaid(false);
    isPaidRef.current = false;
    setTimeLeft(300);

    createKhqrPayment(orderId)
      .then((data) => {
        if (mounted) {
          setPaymentData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setIsLoading(false);
          toast.error(err.message || "Failed to generate ABA PayWay payment.");
        }
      });

    // 2. Real-time WebSocket listener for instant payment confirmation
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.hostname}:8000`
          : "http://localhost:8000");
      const wsUrl = apiBase.replace(/^http/, "ws") + `/api/v1/ws/orders/${orderId}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (
            msg.event === "payment_confirmed" ||
            msg.event === "order_payment_received" ||
            (msg.data && msg.data.payment_status === "paid")
          ) {
            handleSuccess();
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      mounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_) {}
      }
    };
  }, [isOpen, orderId]);

  // 3. Countdown Timer
  useEffect(() => {
    if (!isOpen || isLoading || isPaid) return;

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, isLoading, isPaid]);

  // 4. Automatic Real-Time Polling to detect completed payment automatically
  useEffect(() => {
    if (!isOpen || isLoading || isPaid || timeLeft === 0) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      if (isPaidRef.current) return;
      try {
        const res = await checkPaymentStatus(orderId, paymentData?.transaction_id);
        if (res.is_paid) {
          handleSuccess();
        }
      } catch (err) {
        // Silently continue polling
      }
    };

    // Initial check after 800ms
    const initialCheck = setTimeout(checkStatus, 800);
    pollIntervalRef.current = setInterval(checkStatus, 1800);

    return () => {
      clearTimeout(initialCheck);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, isLoading, isPaid, timeLeft, orderId, paymentData?.transaction_id]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ABA PayWay Header Banner */}
        <div className="bg-gradient-to-r from-[#003B64] via-[#00548B] to-[#0073B7] text-white p-4 pt-5 relative">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-0.5 rounded-md bg-white text-[#004876] text-[11px] font-black tracking-wider uppercase shadow-sm">
                ABA PAYWAY
              </div>
              <span className="text-xs font-semibold text-sky-100">Direct Pay</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ABA PAY
            </div>
          </div>

          <div className="mt-3 text-center">
            <p className="text-[11px] font-medium text-sky-100 uppercase tracking-wider">Amount Due</p>
            <div className="flex items-baseline justify-center gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                ${paymentData ? paymentData.amount_usd.toFixed(2) : "..."}
              </span>
              {paymentData && (
                <span className="text-xs font-semibold text-sky-100/90">
                  ≈ ៛{paymentData.amount_khr.toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-[11px] text-sky-200 mt-0.5">
              Order #{paymentData?.order_number || orderId}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex flex-col items-center">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-9 h-9 text-[#0073B7] animate-spin" />
              <p className="text-xs font-bold text-foreground">Generating ABA PayWay...</p>
              <p className="text-[11px] text-muted-foreground">Connecting to ABA PayWay network</p>
            </div>
          ) : isPaid ? (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-90 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center shadow-lg ring-8 ring-emerald-500/10">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground">Payment Received!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  Thank you! Your transaction has been verified. Redirecting to kitchen status...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* QR Code Container */}
              <div className="relative p-3 bg-white rounded-2xl shadow-inner border border-zinc-200 flex flex-col items-center">
                {paymentData?.qr_image ? (
                  <img
                    src={paymentData.qr_image}
                    alt="ABA PayWay QR Code"
                    className="w-52 h-52 object-contain select-none"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center bg-zinc-50 rounded-xl">
                    <QrCode className="w-12 h-12 text-zinc-300 animate-pulse" />
                  </div>
                )}

                {/* Sub-label under QR */}
                <div className="flex flex-col items-center mt-2 text-center">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-800">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>To: PISETH PERY (ABA Bank)</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    Scan with ABA Mobile or any KHQR banking app
                  </span>
                </div>
              </div>

              {/* Timer Bar */}
              <div className="w-full mt-3.5 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-secondary/60 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">Valid for:</span>
                </div>
                <span className={`font-mono font-bold text-xs ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-foreground"}`}>
                  {timeFormatted}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-2 mt-3.5">
                {(paymentData?.aba_payment_link || paymentData?.abapay_deeplink) && (
                  <a
                    href={paymentData.aba_payment_link || paymentData.abapay_deeplink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#004876] to-[#0073B7] hover:from-[#003B64] hover:to-[#005F9E] text-white font-bold text-xs shadow-md shadow-blue-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open in ABA Mobile App</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                )}

                {/* Real-time automatic payment listener status */}
                <div className="w-full p-2.5 rounded-2xl bg-secondary/60 border border-border/80 flex items-center gap-2.5">
                  <div className="relative flex items-center justify-center shrink-0">
                    <span className="w-2 rounded-full bg-emerald-500 animate-ping absolute"></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-foreground">Awaiting Bank Transfer</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Order will verify automatically once your transfer is received.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
