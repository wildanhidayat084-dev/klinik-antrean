
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { patientSchema } from "@/lib/validations/patient";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = patientSchema.safeParse(body);

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

    // Pastikan layanan masih aktif.
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .eq("id", input.service_id)
      .eq("is_active", true)
      .maybeSingle();

    if (serviceError) {
      console.error("Verifikasi layanan gagal:", serviceError.message);

      return NextResponse.json(
        { message: "Layanan belum dapat diverifikasi." },
        { status: 500 }
      );
    }

    if (!service) {
      return NextResponse.json(
        { message: "Layanan tidak tersedia." },
        { status: 400 }
      );
    }

    // Simpan data pasien.
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        full_name: input.full_name,
        gender: input.gender,
        birth_date: input.birth_date,
        whatsapp: input.whatsapp,
      })
      .select("id")
      .single();

    if (patientError?.code === "23505") {
      return NextResponse.json(
        {
          message:
            "Nomor WhatsApp sudah terdaftar. Silakan hubungi petugas klinik untuk bantuan.",
        },
        { status: 409 }
      );
    }

    if (patientError) {
      console.error("Penyimpanan pasien gagal:", patientError.message);

      return NextResponse.json(
        { message: "Data pasien gagal disimpan." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Data pasien berhasil disimpan.",
        patient_id: patient.id,
        service_id: service.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Kesalahan pada API pendaftaran pasien:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat memproses pendaftaran." },
      { status: 500 }
    );
  }
}
