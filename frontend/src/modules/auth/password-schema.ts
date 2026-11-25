import { z } from "zod";

/** Mirrors the API rule: at least 8 characters with upper, lower, digit and symbol. */
export const strongPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");

export const NIGERIAN_PHONE = /^\+234\d{10}$/;
export const PHONE_MESSAGE = "Enter a Nigerian mobile number like +2348012345678.";
