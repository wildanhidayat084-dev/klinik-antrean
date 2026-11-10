import { z } from "zod";

export function normalizeWhatsApp(input: string): string {
  let phone = input.trim().replace(/[\s().-]/g, "");

  if (phone.startsWith("08")) {
    phone = "+62" + phone.slice(1);
  } else if (phone.startsWith("62")) {
    phone = "+" + phone;
  } else if (phone.startsWith("8")) {
    phone = "+62" + phone;
  }

  return phone;
}

export const patientSchema = z
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
      .iso
      .date("Tanggal lahir tidak valid.")
      .refine(
        (date) => date <= new Date().toISOString().slice(0, 10),
        "Tanggal lahir tidak boleh di masa depan."
      ),

    whatsapp: z.string().trim().min(1, "Nomor WhatsApp wajib diisi."),

    service_id: z.uuid("Layanan tidak valid."),
  })
  .transform((data) => ({
    ...data,
    whatsapp: normalizeWhatsApp(data.whatsapp),
  }))
  .refine((data) => /^\+[1-9]\d{7,14}$/.test(data.whatsapp), {
    path: ["whatsapp"],
    message: "Gunakan nomor WhatsApp yang valid.",
  });

export type PatientRegistrationInput = z.input<typeof patientSchema>;
