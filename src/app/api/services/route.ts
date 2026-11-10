
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";


export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("services")
      .select("id, name, description")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Gagal mengambil layanan:", error.message);

      return NextResponse.json(
        { message: "Layanan belum dapat dimuat." },
        { status: 500 }
      );
    }

    return NextResponse.json({ services: data });
  } catch (error) {
    console.error("Kesalahan konfigurasi layanan:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
