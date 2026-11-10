-- =====================================================================
-- 01_schema.sql
-- Struktur dasar database Klinik Sehat (Supabase / PostgreSQL).
-- Jalankan PERTAMA, sekali saja, di database yang masih kosong.
-- Urutan file: 01_schema.sql -> 02_pendaftaran_antrean.sql -> 03_data_contoh.sql
-- =====================================================================

-- Pasien. Nomor WhatsApp (format +62...) menjadi identitas unik pasien.
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL
        CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
    gender TEXT NOT NULL
        CHECK (gender IN ('Laki-laki', 'Perempuan')),
    birth_date DATE NOT NULL
        CHECK (birth_date <= CURRENT_DATE),
    whatsapp TEXT NOT NULL UNIQUE
        CHECK (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Layanan klinik (Poli Umum, Sunat, dst).
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sesi kunjungan per layanan per tanggal, lengkap dengan kapasitas.
CREATE TABLE public.appointment_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL
        REFERENCES public.services(id),
    visit_date DATE NOT NULL,
    session_name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (end_time > start_time),
    UNIQUE (service_id, visit_date, session_name)
);

-- Pendaftaran kunjungan: satu baris = satu nomor pendaftaran + satu nomor antrean.
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number TEXT NOT NULL UNIQUE,
    patient_id UUID NOT NULL
        REFERENCES public.patients(id),
    service_id UUID NOT NULL
        REFERENCES public.services(id),
    slot_id UUID NOT NULL
        REFERENCES public.appointment_slots(id),
    visit_date DATE NOT NULL,
    queue_number INTEGER NOT NULL
        CHECK (queue_number > 0),
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'checked_in',
                'in_progress',
                'completed',
                'cancelled'
            )
        ),
    registration_source TEXT NOT NULL DEFAULT 'website'
        CHECK (registration_source IN ('website', 'staff')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (service_id, visit_date, queue_number)
);

CREATE INDEX idx_appointments_patient
    ON public.appointments(patient_id);

CREATE INDEX idx_appointments_date_service
    ON public.appointments(visit_date, service_id);

CREATE INDEX idx_appointments_slot
    ON public.appointments(slot_id);

-- Row Level Security: semua tabel dikunci. Pasien tidak mengakses tabel langsung;
-- akses data hanya lewat API server (service role).
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Data layanan aktif boleh dibaca secara publik.
CREATE POLICY "Public can view active services"
ON public.services
FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

-- Jadwal aktif boleh dibaca secara publik.
CREATE POLICY "Public can view active slots"
ON public.appointment_slots
FOR SELECT
TO anon, authenticated
USING (
    is_active = TRUE
    AND EXISTS (
        SELECT 1
        FROM public.services s
        WHERE s.id = service_id
          AND s.is_active = TRUE
    )
);

-- Layanan yang tersedia.
INSERT INTO public.services (name, description)
VALUES
    ('Poli Umum', 'Konsultasi dokter umum'),
    ('Sunat', 'Layanan pendaftaran sunat')
ON CONFLICT (name) DO NOTHING;
