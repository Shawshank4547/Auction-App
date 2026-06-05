import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

interface FormState {
  name: string;
  description: string;
  currency: string;
  timezone: string;
  startingBid: string;
  bidIncrement: string;
  timerDuration: string;
  antiSnipingEnabled: boolean;
  antiSnipingTriggerWindow: string;
  antiSnipingExtension: string;
  antiSnipingMaxExtensions: string;
  allowPause: boolean;
  enableRound2: boolean;
  enableRound3: boolean;
  bidCapEnabled: boolean;
  bidCapAmount: string;
  tieBreakMode: string;
  maxTieBreakRounds: string;
  auctionOrderMode: string;
}

const defaultForm: FormState = {
  name: '',
  description: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  startingBid: '100000',
  bidIncrement: '100000',
  timerDuration: '60',
  antiSnipingEnabled: true,
  antiSnipingTriggerWindow: '30',
  antiSnipingExtension: '30',
  antiSnipingMaxExtensions: '5',
  allowPause: true,
  enableRound2: true,
  enableRound3: false,
  bidCapEnabled: false,
  bidCapAmount: '',
  tieBreakMode: 'sealed_bid',
  maxTieBreakRounds: '0',
  auctionOrderMode: 'manual',
};

// ── These must be defined OUTSIDE the component so React doesn't
//    recreate them on every render (which would unmount inputs and
//    cause the "loses focus after one keystroke" bug). ──────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
    <h3 className="font-semibold text-white border-b border-gray-800 pb-2">{title}</h3>
    {children}
  </div>
);

interface ToggleProps {
  label: string;
  checked: boolean;
  desc?: string;
  onChange: () => void;
}
const Toggle: React.FC<ToggleProps> = ({ label, checked, desc, onChange }) => (
  <label className="flex items-center justify-between cursor-pointer">
    <div>
      <p className="text-sm font-medium text-gray-300">{label}</p>
      {desc && <p className="text-xs text-gray-500">{desc}</p>}
    </div>
    <div
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  </label>
);

const CreateAuctionPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
    }));

  const toggle = (key: keyof FormState) => () =>
    setForm((f) => ({ ...f, [key]: !f[key] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        startingBid: parseInt(form.startingBid),
        bidIncrement: parseInt(form.bidIncrement),
        timerDuration: parseInt(form.timerDuration),
        antiSnipingTriggerWindow: parseInt(form.antiSnipingTriggerWindow),
        antiSnipingExtension: parseInt(form.antiSnipingExtension),
        antiSnipingMaxExtensions: parseInt(form.antiSnipingMaxExtensions),
        bidCapAmount: form.bidCapEnabled && form.bidCapAmount ? parseInt(form.bidCapAmount) : null,
        maxTieBreakRounds: parseInt(form.maxTieBreakRounds) || 0,
      };
      const res = await api.post('/auctions', payload);
      toast.success('Auction created!');
      navigate(`/auctions/${res.data.data.id}/manage`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">Create Auction</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Section title="General">
          <Input
            label="Auction Name *"
            value={form.name}
            onChange={set('name')}
            placeholder="IPL 2025 Mock Auction"
            required
          />
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={2}
              placeholder="Optional description"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={set('currency')}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Auction Order</label>
              <select
                value={form.auctionOrderMode}
                onChange={set('auctionOrderMode')}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="manual">Manual</option>
                <option value="random">Random</option>
                <option value="category">By Category</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Bidding">
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Starting Bid"
              type="number"
              value={form.startingBid}
              onChange={set('startingBid')}
              required
            />
            <Input
              label="Bid Increment"
              type="number"
              value={form.bidIncrement}
              onChange={set('bidIncrement')}
              required
            />
            <Input
              label="Timer (seconds)"
              type="number"
              value={form.timerDuration}
              onChange={set('timerDuration')}
              required
            />
          </div>
        </Section>

        <Section title="Anti-Sniping">
          <Toggle
            label="Enable Anti-Sniping"
            checked={form.antiSnipingEnabled}
            desc="Extend timer when bid placed near end"
            onChange={toggle('antiSnipingEnabled')}
          />
          {form.antiSnipingEnabled && (
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Trigger Window (s)"
                type="number"
                value={form.antiSnipingTriggerWindow}
                onChange={set('antiSnipingTriggerWindow')}
              />
              <Input
                label="Extension (s)"
                type="number"
                value={form.antiSnipingExtension}
                onChange={set('antiSnipingExtension')}
              />
              <Input
                label="Max Extensions"
                type="number"
                value={form.antiSnipingMaxExtensions}
                onChange={set('antiSnipingMaxExtensions')}
                helperText="0 = unlimited"
              />
            </div>
          )}
        </Section>

        <Section title="Bid Cap & Tie-break">
          <Toggle
            label="Enable Bid Cap"
            checked={form.bidCapEnabled}
            desc="Trigger tie-break when cap is reached"
            onChange={toggle('bidCapEnabled')}
          />
          {form.bidCapEnabled && (
            <Input
              label="Cap Amount"
              type="number"
              value={form.bidCapAmount}
              onChange={set('bidCapAmount')}
              placeholder="e.g. 20000000"
              required
            />
          )}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1">Tie-break Mode</label>
            <select
              value={form.tieBreakMode}
              onChange={set('tieBreakMode')}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sealed_bid">Sealed Bid (Recursive)</option>
              <option value="lucky_draw">Lucky Draw</option>
              <option value="organizer_decision">Organizer Decision</option>
            </select>
          </div>
          <Input
            label="Max Tie-break Rounds"
            type="number"
            value={form.maxTieBreakRounds}
            onChange={set('maxTieBreakRounds')}
            helperText="0 = unlimited"
          />
        </Section>

        <Section title="Rounds">
          <Toggle
            label="Enable Round 2"
            checked={form.enableRound2}
            desc="Unsold players re-enter Round 2"
            onChange={toggle('enableRound2')}
          />
          <Toggle
            label="Enable Round 3"
            checked={form.enableRound3}
            desc="Remaining unsold players re-enter Round 3"
            onChange={toggle('enableRound3')}
          />
          <Toggle
            label="Allow Pause"
            checked={form.allowPause}
            desc="Organizer can pause the auction"
            onChange={toggle('allowPause')}
          />
        </Section>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Create Auction
        </Button>
      </form>
    </div>
  );
};

export default CreateAuctionPage;