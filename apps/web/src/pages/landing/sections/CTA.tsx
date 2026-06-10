import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { submitLead, LeadPayload } from '../../../services/leads';

interface FormValues {
  name: string;
  restaurantName: string;
  phone: string;
  email?: string;
  outletCount?: number;
  businessType?: string;
  message?: string;
}

const BUSINESS_TYPES = [
  { value: '', label: 'Select…' },
  { value: 'DINE_IN', label: 'Dine-in restaurant' },
  { value: 'QSR', label: 'QSR / Quick service' },
  { value: 'FOOD_COURT', label: 'Food court' },
  { value: 'CLOUD_KITCHEN', label: 'Cloud kitchen' },
  { value: 'CAFETERIA', label: 'Cafe / Cafeteria' },
  { value: 'OTHER', label: 'Other' },
];

export default function CTA() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register, handleSubmit, formState: { errors, isSubmitting }, reset,
  } = useForm<FormValues>();

  const onSubmit = async (data: FormValues) => {
    try {
      const payload: LeadPayload = {
        name: data.name.trim(),
        restaurantName: data.restaurantName.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || undefined,
        outletCount: data.outletCount ? Number(data.outletCount) : undefined,
        businessType: data.businessType || undefined,
        message: data.message?.trim() || undefined,
        source: 'landing-page',
      };
      await submitLead(payload);
      setSubmitted(true);
      reset();
      toast.success("Thanks — we'll be in touch within one business day.");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Something went wrong. Try again.';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  };

  return (
    <section id="cta" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10" style={{
        background: 'linear-gradient(160deg,#0a0f1e 0%,#0f172a 55%,#1a0a2e 100%)',
      }} />
      <div className="absolute inset-0 -z-10 opacity-50 pointer-events-none">
        <div className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(249,115,22,.25) 0%,transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-20 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-5 gap-12 items-center">
        <div className="lg:col-span-2 text-white">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-300">Get started</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tight leading-tight">
            See VEZEOR on<br />your menu, in 30 minutes.
          </h2>
          <p className="mt-4 text-slate-300 leading-relaxed">
            Tell us about your restaurant. Our team will set up a tailored demo with your menu
            so you can decide with real data, not slides.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Free trial — no card required',
              'Menu imported from your spreadsheet',
              'Onboarding in days, not weeks',
            ].map((b) => (
              <li key={b} className="flex items-center gap-2.5 text-sm text-slate-200">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          {submitted ? (
            <div className="card-glass p-10 text-center text-white">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)' }}>
                <CheckCircle2 size={26} className="text-emerald-400" />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-900">You're on the list.</h3>
              <p className="mt-2 text-sm text-slate-700">
                Our team will reach out within one business day to schedule your demo.
              </p>
              <button onClick={() => setSubmitted(false)} className="btn-ghost mt-6">
                Submit another
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="card p-7 md:p-9 space-y-4"
            >
              <h3 className="text-lg font-black text-slate-900">Book your demo</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Your name" error={errors.name?.message}>
                  <input
                    className="input"
                    placeholder="Anjali Menon"
                    {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })}
                  />
                </Field>
                <Field label="Restaurant name" error={errors.restaurantName?.message}>
                  <input
                    className="input"
                    placeholder="Saffron Spoon"
                    {...register('restaurantName', { required: 'Restaurant name is required' })}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Phone" error={errors.phone?.message}>
                  <input
                    className="input"
                    placeholder="9876543210"
                    type="tel"
                    {...register('phone', {
                      required: 'Phone is required',
                      pattern: { value: /^[+0-9 \-]{7,20}$/, message: 'Invalid phone' },
                    })}
                  />
                </Field>
                <Field label="Email (optional)" error={errors.email?.message}>
                  <input
                    className="input"
                    placeholder="anjali@saffronspoon.in"
                    type="email"
                    {...register('email', {
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
                    })}
                  />
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Business type" error={errors.businessType?.message}>
                  <select className="input" {...register('businessType')}>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="No. of outlets" error={errors.outletCount?.message}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={10000}
                    placeholder="1"
                    {...register('outletCount', {
                      valueAsNumber: true,
                      min: { value: 1, message: 'Must be at least 1' },
                    })}
                  />
                </Field>
              </div>

              <Field label="Anything we should know? (optional)" error={errors.message?.message}>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Cuisine, current POS, what you're hoping to fix…"
                  {...register('message', { maxLength: { value: 2000, message: 'Too long' } })}
                />
              </Field>

              <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Request a demo <ArrowRight size={16} />
                  </span>
                )}
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                By submitting, you agree to be contacted by VEZEOR. We never share your info.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
    </div>
  );
}
