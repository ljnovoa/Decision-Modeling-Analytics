/**
 * toast.ts
 * Custom branded toast notifications using Sonner's JSX custom() renderer.
 * Renders the app name "AHP Tool — Designed by Luis Novoa & built using Manus"
 * at the top of every notification, replacing the default platform label.
 *
 * Usage: import { ahpToast } from "@/lib/toast";
 *        ahpToast.success("Saved!");
 */

import { toast } from "sonner";
import { createElement as h } from "react";

const APP_NAME = "AHP Tool — Designed by Luis Novoa & built using Manus";

type ToastType = "success" | "error" | "info" | "warning" | "default";

const COLORS: Record<ToastType, { border: string; icon: string; label: string }> = {
  success: { border: "#10b981", icon: "✓", label: "#10b981" },
  error:   { border: "#ef4444", icon: "✕", label: "#ef4444" },
  info:    { border: "#0ea5e9", icon: "ℹ", label: "#0ea5e9" },
  warning: { border: "#f59e0b", icon: "⚠", label: "#f59e0b" },
  default: { border: "#94a3b8", icon: "•", label: "#94a3b8" },
};

function makeToast(type: ToastType, message: string) {
  const c = COLORS[type];
  return toast.custom(
    () =>
      h(
        "div",
        {
          style: {
            background: "#fff",
            border: `1px solid #e2e8f0`,
            borderLeft: `4px solid ${c.border}`,
            borderRadius: "8px",
            padding: "10px 14px",
            minWidth: "280px",
            maxWidth: "360px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          },
        },
        // App name header
        h(
          "div",
          {
            style: {
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: "4px",
            },
          },
          APP_NAME
        ),
        // Message row
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
            },
          },
          h(
            "span",
            {
              style: {
                color: c.label,
                fontWeight: 700,
                fontSize: "14px",
                lineHeight: 1,
              },
            },
            c.icon
          ),
          h(
            "span",
            {
              style: {
                fontSize: "13px",
                fontWeight: 500,
                color: "#1e293b",
                lineHeight: 1.4,
              },
            },
            message
          )
        )
      ),
    { duration: 3000 }
  );
}

export const ahpToast = {
  success: (message: string) => makeToast("success", message),
  error:   (message: string) => makeToast("error",   message),
  info:    (message: string) => makeToast("info",     message),
  warning: (message: string) => makeToast("warning",  message),
  message: (message: string) => makeToast("default",  message),
};
