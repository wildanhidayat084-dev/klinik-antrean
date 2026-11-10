"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { normalizeWhatsApp } from "@/lib/validations/patient";
import { todayInJakarta } from "@/lib/date";

type Step = 1 | 2 | 3;

type Service = {
  id: string;
  name: string;
  description: string | null;
};

type FormData = {
  full_name: string;
  gender: string;
  birth_date: string;
  whatsapp: string;
  service_id: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

type Slot = {
  id: string;
  service_id: string;
  visit_date: string; // format YYYY-MM-DD
  session_name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  remaining: number;
  is_full: boolean;
};

// Data pendaftaran yang dikembalikan server setelah berhasil
type Appointment = {
  appointment_id: string;
  registration_number: string;
  queue_number: number;
  status: string;
  patient_name: string;
  service_name: string;
  visit_date: string;
  session_name: string;
  start_time: string;
  end_time: string;
};

// Hasil pengambilan jadwal, dicatat bersama layanan yang dipakai saat mengambilnya
type SlotResult = { serviceId: string; slots: Slot[]; error?: string };

const STEP_LABELS = ["Data diri & layanan", "Pilih jadwal", "Konfirmasi"];

const DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const INITIAL_FORM: FormData = {
  full_name: "",
  gender: "",
  birth_date: "",
  whatsapp: "",
  service_id: "",
};

const pad = (n: number) => String(n).padStart(2, "0");

// 2026-11-03 -> "Selasa, 3 November 2026"
function formatLongDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${DAY_NAMES[weekday]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

// "08:00:00" -> "08.00"
function formatTime(time: string): string {
  return time.slice(0, 5).replace(":", ".");
}

// 2026-11-03 -> nomor bulan berurutan (dipakai untuk membandingkan dan berpindah bulan)
function monthIndexOf(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return year * 12 + (month - 1);
}

// Memeriksa isi langkah 1. Hasilnya daftar pesan error per kolom (kosong = valid).
function validateStep1(form: FormData): FormErrors {
  const errors: FormErrors = {};
  const name = form.full_name.trim();

  if (name.length < 2) {
    errors.full_name = "Nama minimal 2 karakter.";
  } else if (name.length > 120) {
    errors.full_name = "Nama maksimal 120 karakter.";
  }

  if (form.gender !== "Laki-laki" && form.gender !== "Perempuan") {
    errors.gender = "Pilih jenis kelamin.";
  }

  if (!form.birth_date) {
    errors.birth_date = "Tanggal lahir wajib diisi.";
  } else if (form.birth_date > todayInJakarta()) {
    errors.birth_date = "Tanggal lahir tidak boleh di masa depan.";
  }

  if (!form.whatsapp.trim()) {
    errors.whatsapp = "Nomor WhatsApp wajib diisi.";
  } else if (!/^\+[1-9]\d{7,14}$/.test(normalizeWhatsApp(form.whatsapp))) {
    errors.whatsapp = "Gunakan nomor WhatsApp yang valid.";
  }

  if (!form.service_id) {
    errors.service_id = "Pilih poli atau layanan.";
  }

  return errors;
}

// ---------- Bagian-bagian kecil tampilan ----------

function Header() {
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="text-lg font-bold text-slate-900">Klinik Sehat</p>
          <p className="text-xs text-slate-500">Layanan kesehatan, lebih mudah</p>
        </div>
      </div>
    </header>
  );
}

function Stepper({ step }: { step: Step }) {
  // Garis hijau memanjang sesuai langkah: 0% (langkah 1), 50% (2), 100% (3)
  const progress = ((step - 1) / 2) * 100;

  return (
    <ol className="relative grid grid-cols-3 rounded-2xl border border-slate-200 bg-white px-2 py-5 shadow-sm">
      <div className="absolute left-[16.66%] right-[16.66%] top-[34px] h-0.5 bg-slate-200">
        <div
          className="h-full bg-teal-700 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {STEP_LABELS.map((label, index) => {
        const number = (index + 1) as Step;
        const done = step > number;
        const current = step === number;

        return (
          <li key={label} className="relative flex flex-col items-center gap-2">
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                done || current
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-slate-300 bg-white text-slate-500",
                current ? "ring-4 ring-teal-100" : "",
              ].join(" ")}
            >
              {done ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                number
              )}
            </span>
            <span
              className={`text-center text-xs sm:text-sm ${
                current ? "font-semibold text-slate-900" : "text-slate-500"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label} <span className="text-red-500">*</span>
        <div className="mt-1.5 font-normal">{children}</div>
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Calendar({
  monthIdx,
  minIdx,
  maxIdx,
  onMonthChange,
  availableDates,
  selectedDate,
  onSelect,
}: {
  monthIdx: number;
  minIdx: number;
  maxIdx: number;
  onMonthChange: (idx: number) => void;
  availableDates: Set<string>;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const year = Math.floor(monthIdx / 12);
  const month = monthIdx % 12;

  // Kalender mulai dari hari Senin: berapa kotak kosong sebelum tanggal 1?
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-slate-900">Tanggal kunjungan</p>
          <p className="font-bold text-slate-900">
            {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            className={arrow}
            disabled={monthIdx <= minIdx}
            onClick={() => onMonthChange(monthIdx - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            className={arrow}
            disabled={monthIdx >= maxIdx}
            onClick={() => onMonthChange(monthIdx + 1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
        {DAY_HEADERS.map((day) => (
          <span key={day} className="py-1 text-xs font-semibold text-slate-400">
            {day}
          </span>
        ))}

        {cells.map((day, index) => {
          if (day === null) return <span key={`kosong-${index}`} />;

          const iso = `${year}-${pad(month + 1)}-${pad(day)}`;
          const available = availableDates.has(iso);
          const selected = iso === selectedDate;

          return (
            <button
              key={iso}
              type="button"
              disabled={!available}
              onClick={() => onSelect(iso)}
              aria-pressed={selected}
              className={[
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm",
                selected
                  ? "bg-teal-700 font-semibold text-white"
                  : available
                    ? "font-semibold text-slate-900 hover:bg-teal-50"
                    : "text-slate-300",
              ].join(" ")}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({
  slot,
  selected,
  onSelect,
}: {
  slot: Slot;
  selected: boolean;
  onSelect: () => void;
}) {
  const full = slot.is_full;

  return (
    <button
      type="button"
      disabled={full}
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "rounded-xl border-2 px-4 py-3 text-left",
        selected
          ? "border-teal-700 bg-teal-50"
          : full
            ? "border-slate-200 bg-slate-50"
            : "border-slate-200 bg-white hover:border-teal-300",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">Sesi {slot.session_name}</span>
        <span
          className={`text-xs font-semibold ${
            selected ? "text-teal-700" : full ? "text-red-500" : "text-emerald-600"
          }`}
        >
          {selected ? "✓ Dipilih" : full ? "Penuh" : "Tersedia"}
        </span>
      </span>
      <span className="mt-0.5 block text-xs text-slate-500">
        {formatTime(slot.start_time)}–{formatTime(slot.end_time)} WIB
      </span>
    </button>
  );
}

// Menggambar barcode (CODE128) dari teks, misalnya nomor pendaftaran
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: false,
      height: 48,
      width: 1.5,
      margin: 0,
      background: "transparent",
      lineColor: "#0f172a",
    });
  }, [value]);

  return (
    <svg
      ref={ref}
      className="block h-auto w-full"
      role="img"
      aria-label={`Barcode ${value}`}
    />
  );
}

// Kartu bukti pendaftaran: inilah satu-satunya bagian yang ikut tercetak
function ProofCard({ appointment }: { appointment: Appointment }) {
  return (
    <section className="print-area overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:mx-auto print:my-12 print:max-w-sm print:shadow-none">
      <div className="bg-teal-700 px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">
          Bukti pendaftaran
        </p>
        <p className="text-xl font-bold">Klinik Sehat</p>
      </div>

      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Nomor pendaftaran
        </p>
        <p className="text-2xl font-bold text-slate-900">
          {appointment.registration_number}
        </p>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="font-bold text-slate-900">{appointment.patient_name}</p>
          <p className="text-sm text-slate-500">{appointment.service_name}</p>
        </div>

        <div className="mt-4 text-sm">
          <p className="font-bold text-slate-900">
            {formatLongDate(appointment.visit_date)}
          </p>
          <p className="font-bold text-slate-900">
            {formatTime(appointment.start_time)}–{formatTime(appointment.end_time)} WIB
          </p>
          <p className="mt-1 text-slate-500">
            Nomor antrean: <span className="font-bold text-slate-900">{appointment.queue_number}</span>
          </p>
        </div>

        <div className="mt-5">
          <Barcode value={appointment.registration_number} />
          <p className="mt-1 text-center text-[10px] tracking-widest text-slate-400">
            {appointment.registration_number.replace(/-/g, "")}
          </p>
        </div>

        <p className="mt-4 border-t border-dashed border-slate-300 pt-4 text-sm font-semibold text-teal-700">
          Simpan bukti ini untuk check-in.
        </p>
      </div>
    </section>
  );
}

function PrepareCard() {
  const items = [
    "Identitas diri yang sesuai",
    "Nomor pendaftaran di atas",
    "Datang 15 menit lebih awal",
  ];

  return (
    <section className="rounded-2xl bg-teal-50 p-6 print:hidden">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
          !
        </span>
        <h2 className="font-bold text-slate-900">Yang perlu kamu siapkan</h2>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="text-teal-700">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryCard({
  patientName,
  service,
  dateLabel,
  timeLabel,
}: {
  patientName: string;
  service?: Service;
  dateLabel?: string;
  timeLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Ringkasan pendaftaran</h2>
      <p className="text-sm text-slate-500">Periksa kembali detail kunjunganmu</p>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pasien</p>
        <p className="mt-1 font-bold text-slate-900">{patientName.trim() || "-"}</p>
      </div>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        <div>
          <p className="font-semibold text-slate-900">{service?.name ?? "Belum dipilih"}</p>
          <p className="text-xs text-slate-500">
            {service?.description ?? "Pilih poli atau layanan"}
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Jadwal kunjungan</p>
          <p className="text-xs text-slate-500">Pilih tanggal dan jam berikutnya</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-400">Tanggal</p>
          <p className="text-sm font-semibold text-slate-900">
            {dateLabel || "Belum dipilih"}
          </p>
          {timeLabel && <p className="text-xs text-slate-500">{timeLabel}</p>}
        </div>
      </div>
    </section>
  );
}

function HelpCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-900">Butuh bantuan?</h2>
      <p className="mt-1 text-sm text-slate-500">
        Tim administrasi siap membantu proses pendaftaranmu pada hari kerja.
      </p>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="font-semibold text-slate-900">(031) 555-0188</p>
        <p className="text-xs text-slate-500">Senin–Sabtu, 08.00–20.00</p>
      </div>
    </section>
  );
}

// ---------- Halaman utama ----------

export default function HomePage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError, setServiceError] = useState("");

  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [slotsVersion, setSlotsVersion] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [monthIdx, setMonthIdx] = useState<number | null>(null);

  // Ambil daftar layanan sekali saat halaman dibuka
  useEffect(() => {
    let cancelled = false;

    async function fetchServices() {
      try {
        const response = await fetch("/api/services");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Gagal mengambil layanan klinik.");
        }

        if (!cancelled) setServices(result.services ?? []);
      } catch (error) {
        if (!cancelled) {
          setServiceError(
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan saat memuat layanan."
          );
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    }

    fetchServices();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ambil jadwal setiap kali pasien masuk ke langkah 2 (kuota bisa berubah sewaktu-waktu)
  useEffect(() => {
    if (step !== 2 || !form.service_id) return;

    const serviceId = form.service_id;
    let cancelled = false;

    async function fetchSlots() {
      try {
        const response = await fetch(`/api/slots?service_id=${serviceId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Jadwal belum dapat dimuat.");
        }

        if (!cancelled) {
          setSlotResult({ serviceId, slots: result.slots ?? [] });
        }
      } catch (error) {
        if (!cancelled) {
          setSlotResult({
            serviceId,
            slots: [],
            error:
              error instanceof Error
                ? error.message
                : "Terjadi kesalahan saat memuat jadwal.",
          });
        }
      }
    }

    fetchSlots();

    return () => {
      cancelled = true;
    };
  }, [step, form.service_id, slotsVersion]);

  const selectedService = services.find((s) => s.id === form.service_id);

  // Data jadwal hanya dipakai kalau memang milik layanan yang sedang dipilih
  const slotsReady = slotResult?.serviceId === form.service_id;
  const loadingSlots = step === 2 && !slotsReady;
  const slotError = slotsReady ? (slotResult?.error ?? "") : "";
  const slots = slotsReady ? (slotResult?.slots ?? []) : [];

  // Tanggal yang masih punya setidaknya satu sesi dengan kuota tersisa
  const availableDates = new Set(
    slots.filter((slot) => !slot.is_full).map((slot) => slot.visit_date)
  );
  const sortedDates = Array.from(availableDates).sort();
  const minIdx = sortedDates.length ? monthIndexOf(sortedDates[0]) : 0;
  const maxIdx = sortedDates.length
    ? monthIndexOf(sortedDates[sortedDates.length - 1])
    : 0;
  const shownMonthIdx = Math.min(Math.max(monthIdx ?? minIdx, minIdx), maxIdx);

  // Tanggal terpilih hanya berlaku kalau masih tersedia setelah jadwal diperbarui
  const chosenDate = availableDates.has(selectedDate) ? selectedDate : "";

  // Sesi pada tanggal terpilih, urut dari yang paling pagi
  const sessionsOfDate = slots
    .filter((slot) => slot.visit_date === chosenDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Sesi terpilih hanya berlaku kalau masih ada di tanggal ini dan belum penuh
  const chosenSlot = sessionsOfDate.find(
    (slot) => slot.id === selectedSlotId && !slot.is_full
  );

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Hapus pesan error kolom ini begitu pasien mulai memperbaikinya
    setErrors((prev) => ({ ...prev, [name]: undefined }));

    // Ganti layanan berarti jadwalnya berbeda, jadi pilihan tanggal diulang
    if (name === "service_id") {
      setSelectedDate("");
      setSelectedSlotId("");
      setMonthIdx(null);
    }
  }

  // Ganti tanggal berarti sesi yang dipilih sebelumnya tidak berlaku lagi
  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlotId("");
  }

  // Kirim pendaftaran ke server (dipanggil tombol "Konfirmasi pendaftaran")
  async function handleConfirm() {
    if (!chosenSlot || submitting) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          gender: form.gender,
          birth_date: form.birth_date,
          whatsapp: form.whatsapp,
          service_id: form.service_id,
          slot_id: chosenSlot.id,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        // Pesan detail kolom (kalau ada) ditambahkan di belakang pesan utama
        const detail = result.errors
          ? (Object.values(result.errors).flat()[0] as string | undefined)
          : "";
        setSubmitError(
          `${result.message || "Pendaftaran gagal diproses."}${detail ? ` ${detail}` : ""}`
        );

        // Sesi penuh / tidak tersedia: muat ulang jadwal supaya tampilannya terbaru
        if (response.status === 409 || response.status === 400) {
          setSlotsVersion((v) => v + 1);
        }
        return;
      }

      setAppointment(result.appointment);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setSubmitting(false);
    }
  }

  // Mulai pendaftaran baru dari awal
  function handleReset() {
    setForm(INITIAL_FORM);
    setErrors({});
    setSelectedDate("");
    setSelectedSlotId("");
    setMonthIdx(null);
    setSlotResult(null);
    setSubmitError("");
    setAppointment(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validateStep1(form);
    setErrors(found);

    if (Object.keys(found).length > 0) return;

    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Border merah untuk kolom yang error (inline agar menang atas CSS global)
  const invalid = (name: keyof FormData) =>
    errors[name] ? { borderColor: "#ef4444" } : undefined;

  return (
    <div className="min-h-screen bg-slate-50 print:min-h-0 print:bg-white">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 print:p-0">
        <div className="print:hidden">
        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold text-slate-900">
              Daftar kunjungan tanpa antre di loket
            </h1>
            <p className="mt-1 text-slate-500">
              Lengkapi data pasien dan pilih layanan yang sesuai dengan kebutuhanmu.
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-3xl font-bold text-slate-900">
              Pilih tanggal dan jam kunjungan
            </h1>
            <p className="mt-1 text-slate-500">
              Jadwal yang tampil merupakan slot kunjungan yang tersedia
              {selectedService ? ` untuk ${selectedService.name}.` : "."}
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-3xl font-bold text-slate-900">
              Pendaftaran berhasil dibuat
            </h1>
            <p className="mt-1 text-slate-500">
              Bukti pendaftaran sudah siap. Simpan nomor pendaftaran untuk proses
              check-in di klinik.
            </p>
          </>
        )}

        <div className="mt-6">
          <Stepper step={step} />
        </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Kolom kiri: isi langkah */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:hidden">
            {step === 1 && (
              <form onSubmit={handleNext} noValidate>
                <h2 className="text-lg font-bold text-slate-900">Data diri pasien</h2>
                <p className="text-sm text-slate-500">
                  Pastikan data sesuai dengan identitas yang berlaku.
                </p>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field label="Nama lengkap" error={errors.full_name}>
                    <input
                      name="full_name"
                      value={form.full_name}
                      onChange={handleChange}
                      placeholder="Nama sesuai identitas"
                      autoComplete="name"
                      style={invalid("full_name")}
                    />
                  </Field>

                  <Field label="Jenis kelamin" error={errors.gender}>
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleChange}
                      style={invalid("gender")}
                    >
                      <option value="">Pilih jenis kelamin</option>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </Field>

                  <Field label="Tanggal lahir" error={errors.birth_date}>
                    <input
                      type="date"
                      name="birth_date"
                      value={form.birth_date}
                      onChange={handleChange}
                      style={invalid("birth_date")}
                    />
                  </Field>

                  <Field label="Nomor WhatsApp" error={errors.whatsapp}>
                    <input
                      type="tel"
                      inputMode="tel"
                      name="whatsapp"
                      value={form.whatsapp}
                      onChange={handleChange}
                      placeholder="0812 3456 7890"
                      autoComplete="tel"
                      style={invalid("whatsapp")}
                    />
                  </Field>
                </div>

                <h3 className="mt-8 text-base font-bold text-slate-900">
                  Pilih poli atau layanan
                </h3>
                <p className="mb-3 text-sm text-slate-500">
                  Kamu dapat mengubah pilihan sebelum konfirmasi.
                </p>

                <div className="sm:max-w-[calc(50%-10px)]">
                  <Field label="Poli / layanan" error={errors.service_id}>
                    <select
                      name="service_id"
                      value={form.service_id}
                      onChange={handleChange}
                      disabled={loadingServices || services.length === 0}
                      style={invalid("service_id")}
                    >
                      <option value="">
                        {loadingServices ? "Memuat layanan..." : "Pilih poli atau layanan"}
                      </option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {serviceError && (
                    <p className="mt-1 text-sm text-red-600">{serviceError}</p>
                  )}
                </div>

                <p className="mt-6 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-800">
                  Data kamu digunakan hanya untuk keperluan pendaftaran dan pelayanan.
                </p>

                <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    * Wajib diisi sebelum melanjutkan.
                  </p>
                  <button
                    type="submit"
                    className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800"
                  >
                    Pilih jadwal →
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900">Jadwal tersedia</h2>
                  {selectedService && (
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                      ● {selectedService.name}
                    </span>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-5">
                  {loadingSlots ? (
                    <p className="text-sm text-slate-500">Memuat jadwal...</p>
                  ) : slotError ? (
                    <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                      {slotError}
                    </p>
                  ) : sortedDates.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      Belum ada jadwal tersedia untuk layanan ini.
                    </p>
                  ) : (
                    <div className="grid gap-8 md:grid-cols-2">
                      <div>
                        <Calendar
                          monthIdx={shownMonthIdx}
                          minIdx={minIdx}
                          maxIdx={maxIdx}
                          onMonthChange={setMonthIdx}
                          availableDates={availableDates}
                          selectedDate={chosenDate}
                          onSelect={handleSelectDate}
                        />
                        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-xs text-slate-400">Tanggal dipilih</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {chosenDate ? formatLongDate(chosenDate) : "Belum dipilih"}
                          </p>
                        </div>
                      </div>

                      <div className="md:border-l md:border-slate-100 md:pl-8">
                        <p className="font-bold text-slate-900">Pilih Sesi Kunjungan</p>
                        <p className="text-sm text-slate-500">
                          {chosenDate
                            ? "Pilih sesi yang masih tersedia."
                            : "Pilih tanggal terlebih dahulu."}
                        </p>
                        {chosenDate && (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {sessionsOfDate.map((slot) => (
                              <SessionCard
                                key={slot.id}
                                slot={slot}
                                selected={slot.id === chosenSlot?.id}
                                onSelect={() => setSelectedSlotId(slot.id)}
                              />
                            ))}
                          </div>
                        )}
                        {chosenDate && (
                          <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">
                            Harap datang 15 menit sebelum jadwal. Jadwal dapat berubah
                            sesuai ketersediaan.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  {submitError && (
                    <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </p>
                  )}
                  <p className="mb-4 text-xs text-slate-500">
                    Data pasien telah diperiksa. Lanjutkan untuk menyimpan pendaftaran.
                  </p>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={submitting}
                      className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={!chosenSlot || submitting}
                      className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800"
                    >
                      {submitting ? "Menyimpan..." : "Konfirmasi pendaftaran →"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {step === 3 && appointment && (
              <div>
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <h2 className="mt-4 text-2xl font-bold text-slate-900">
                    Terima kasih, {appointment.patient_name.split(" ")[0]}!
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Data pendaftaranmu berhasil divalidasi dan tersimpan.
                  </p>
                  <span className="mt-4 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                    ● Pendaftaran terkonfirmasi
                  </span>
                </div>

                <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Nomor pendaftaran</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {appointment.registration_number}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-5 py-3 text-center">
                    <p className="text-xs text-slate-500">Nomor antrean</p>
                    <p className="text-2xl font-bold text-teal-700">
                      {appointment.queue_number}
                    </p>
                  </div>
                </div>

                <dl className="mt-6 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
                  {[
                    ["Pasien", appointment.patient_name],
                    ["Layanan", appointment.service_name],
                    ["Tanggal kunjungan", formatLongDate(appointment.visit_date)],
                    [
                      "Jam kunjungan",
                      `Sesi ${appointment.session_name} · ${formatTime(appointment.start_time)}–${formatTime(appointment.end_time)} WIB`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {label}
                      </dt>
                      <dd className="mt-1 font-bold text-slate-900">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Datang 15 menit lebih awal dan tunjukkan bukti pendaftaran kepada
                  petugas saat tiba di klinik.
                </p>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Daftar kunjungan lain
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800"
                  >
                    Unduh bukti pendaftaran ↓
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Kolom kanan: ringkasan dan bantuan */}
          <aside className="space-y-6">
            {step === 3 && appointment ? (
              <>
                <ProofCard appointment={appointment} />
                <PrepareCard />
              </>
            ) : (
              <>
                <SummaryCard
                  patientName={form.full_name}
                  service={selectedService}
                  dateLabel={chosenDate ? formatLongDate(chosenDate) : ""}
                  timeLabel={
                    chosenSlot
                      ? `Sesi ${chosenSlot.session_name} · ${formatTime(chosenSlot.start_time)}–${formatTime(chosenSlot.end_time)} WIB`
                      : ""
                  }
                />
                <HelpCard />
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}