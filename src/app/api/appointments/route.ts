import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appointmentSchema } from "@/lib/validations/appointment";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Permintaan tidak valid." },
        { status: 400 }
      );
    }

    const parsed = appointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          message: "Periksa kembali data pendaftaran.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("create_appointment", {
      p_full_name: input.full_name,
      p_gender: input.gender,
      p_birth_date: input.birth_date,
      p_whatsapp: input.whatsapp,
      p_service_id: input.service_id,
      p_slot_id: input.slot_id,
    });

    if (error) {
      if (error.message.includes("SLOT_FULL")) {
        return NextResponse.json(
          { message: "Sesi ini sudah penuh. Silakan pilih sesi lain." },
          { status: 409 }
        );
      }

      if (
        error.message.includes("SLOT_NOT_FOUND") ||
        error.message.includes("SLOT_EXPIRED")
      ) {
        return NextResponse.json(
          { message: "Sesi kunjungan tidak tersedia. Silakan pilih sesi lain." },
          { status: 400 }
        );
      }

      if (error.code === "23505") {
        return NextResponse.json(
          { message: "Anda sudah terdaftar pada sesi ini." },
          { status: 409 }
        );
      }

      console.error("Pendaftaran kunjungan gagal:", error.message);

      return NextResponse.json(
        { message: "Pendaftaran gagal diproses. Silakan coba lagi." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Pendaftaran berhasil dibuat.", appointment: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Kesalahan pada API pendaftaran kunjungan:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat memproses pendaftaran." },
      { status: 500 }
    );
  }
}