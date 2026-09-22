import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  Building,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { Client } from '../types';
import { validateKraPin, normalizeKenyanPhone } from '../utils/formatters';

interface ClientModalProps {
  isOpen: boolean;
  client?: Client | null;
  onClose: () => void;
  onSaveClient: (client: Client) => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  client,
  onClose,
  onSaveClient,
}) => {
  const isEditing = Boolean(client && client.id);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setContactPerson(client.contactPerson || '');
      setKraPin(client.kraPin || '');
      setPhone(client.phone || '');
      setEmail(client.email || '');
      setAddress(client.address || '');
    } else {
      setName('');
      setContactPerson('');
      setKraPin('');
      setPhone('');
      setEmail('');
      setAddress('');
    }
    setValidationError(null);
  }, [client, isOpen]);

  if (!isOpen) return null;

  const kraValidation = validateKraPin(kraPin);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Please specify the Client or Company Name.');
      return;
    }

    const clientToSave: Client = {
      id: client?.id || `cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      kraPin: kraPin.trim().toUpperCase(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      createdAt: client?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveClient(clientToSave);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                {isEditing ? 'Edit Client Record' : 'Register New Client Profile'}
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                  Guarded Master
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `Updating official record for ${client?.name}`
                  : 'Add a corporate partner or recurring guest to Hotel Damview database'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 font-medium">
              {validationError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Client / Company Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kenya Red Cross Society or Machakos County"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">KRA Tax PIN</label>
                  {kraPin && (
                    kraValidation.isValid ? (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Valid PIN
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {kraValidation.message}
                      </span>
                    )
                  )}
                </div>
                <input
                  type="text"
                  maxLength={11}
                  value={kraPin}
                  onChange={(e) => setKraPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="P051234567Z"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telephone / Mobile</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={(e) => setPhone(normalizeKenyanPhone(e.target.value))}
                    placeholder="0722 000 000 or +254..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Contact Person / Liaison</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Faith Ndanu (Procurement)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                    placeholder="finance@organization.co.ke"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Physical / Postal Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. P.O. Box 40241 - 00100 Nairobi / Machakos Road Office"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Guarded sync to Google Sheets</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Update Client' : 'Register Client'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
