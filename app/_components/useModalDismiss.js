"use client";

import { useEffect } from "react";
import { registerModal } from "app/lib/modalStack";

/** Register an open modal so hardware back closes it first. */
export function useModalDismiss(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || typeof onClose !== "function") return undefined;
    return registerModal(String(Math.random()), onClose);
  }, [isOpen, onClose]);
}
