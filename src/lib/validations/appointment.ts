import { z } from "zod";
import { normalizeWhatsApp } from "@/lib/validations/patient";
import { todayInJakarta } from "@/lib/date";

export const appointmentSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, "Nama minimal 2 karakter.")
      .max(120, "Nama maksimal 120 karakter."),

    gender: z.enum(["Laki-laki", "Perempuan"], {
      error: "Pilih jenis kelamin.",
    }),

    birth_date: z
      .iso.date("Tanggal lahir tidak valid.")
      .refine(
        (date) => date <= todayInJakarta(),
        "Tanggal lahir tidak boleh di masa depan."
      ),

    whatsapp: z.string().trim().min(1, "Nomor WhatsApp wajib diisi."),

    service_id: z.uuid("Layanan tidak valid."),
    slot_id: z.uuid("Sesi kunjungan tidak valid."),
  })
  .transform((data) => ({
    ...data,
    whatsapp: normalizeWhatsApp(data.whatsapp),
  }))
  .refine((data) => /^\+[1-9]\d{7,14}$/.test(data.whatsapp), {
    path: ["whatsapp"],
    message: "Gunakan nomor WhatsApp yang valid.",
  });

export type AppointmentInput = z.input<typeof appointmentSchema>;