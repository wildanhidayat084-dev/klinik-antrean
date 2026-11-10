import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInJakarta } from "@/lib/date";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("service_id");
    const visitDate = searchParams.get("visit_date");

    if (!serviceId || !UUID_RE.test(serviceId)) {
      return NextResponse.json(
        { message: "Pilih layanan yang valid." },
        { status: 400 }
      );
    }

    if (visitDate && !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
      return NextResponse.json(
        { message: "Format tanggal tidak valid." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("slot_availability")
      .select(
        "id, service_id, visit_date, session_name, start_time, end_time, capacity, remaining"
      )
      .eq("service_id", serviceId)
      .gte("visit_date", todayInJakarta())
      .order("visit_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (visitDate) {
      query = query.eq("visit_date", visitDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Gagal mengambil jadwal:", error.message);

      return NextResponse.json(
        { message: "Jadwal belum dapat dimuat." },
        { status: 500 }
      );
    }

    const slots = (data ?? []).map((slot) => ({
      ...slot,
      is_full: slot.remaining <= 0,
    }));

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Kesalahan API jadwal:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan saat mengambil jadwal." },
      { status: 500 }
    );
  }
}