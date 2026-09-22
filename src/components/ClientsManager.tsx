import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  FileSpreadsheet,
  FileText,
  Mail,
  Phone,
  MapPin,
  Building,
  CheckCircle,
} from 'lucide-react';
import { Client } from '../types';
import { ClientModal } from './ClientModal';

interface ClientsManagerProps {
  clients: Client[];
  onSaveClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onViewLedger: (clientId: string) => void;
  onNewDocForClient: (clientId: string) => void;
}

export const ClientsManager: React.FC<ClientsManagerProps> = ({
  clients,
  onSaveClient,
  onDeleteClient,
  onViewLedger,
  onNewDocForClient,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const openCreateModal = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleModalSave = (clientToSave: Client) => {
    onSaveClient(clientToSave);
    setIsModalOpen(false);
  };

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.kraPin && c.kraPin.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-700" />
            Client Directory & Profiles
          </h1>
          <p className="text-sm text-stone-600">
            Registered corporate clients, government agencies, safari groups, and private event guests.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          Register New Client
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-stone-200 rounded p-4 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, KRA PIN, contact person, email..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-stone-500 text-stone-900 bg-stone-50/50"
          />
        </div>

        <span className="text-xs text-stone-500 font-medium">
          Total Registered: <strong className="text-stone-900">{clients.length}</strong>
        </span>
      </div>

      {/* Client Datatable */}
      <div className="bg-white border border-stone-200 rounded shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 font-bold">
                <th className="py-2.5 px-3">Client / Organization</th>
                <th className="py-2.5 px-3">Contact Person</th>
                <th className="py-2.5 px-3">KRA PIN</th>
                <th className="py-2.5 px-3">Phone & Email</th>
                <th className="py-2.5 px-3">Physical Address</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-stone-900 text-sm">{client.name}</div>
                      <div className="text-[10px] text-stone-400">Reg: {client.createdAt}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-stone-800">
                      {client.contactPerson || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      {client.kraPin ? (
                        <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800 border border-stone-200 font-semibold">
                          {client.kraPin}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-stone-800 font-medium">{client.phone || '-'}</div>
                      <div className="text-stone-500 text-[11px]">{client.email || '-'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-stone-600 max-w-xs truncate">
                      {client.address || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* View Ledger */}
                        <button
                          type="button"
                          onClick={() => onViewLedger(client.id)}
                          className="px-2 py-1 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded font-semibold text-[11px] flex items-center gap-1"
                          title="View Statement of Account / Ledger"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          Ledger
                        </button>

                        {/* New Document */}
                        <button
                          type="button"
                          onClick={() => onNewDocForClient(client.id)}
                          className="px-2 py-1 bg-stone-100 text-stone-800 hover:bg-stone-200 rounded font-semibold text-[11px] flex items-center gap-1"
                          title="Create New Document for Client"
                        >
                          <FileText className="w-3 h-3" />
                          Bill
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => openEditModal(client)}
                          className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded"
                          title="Edit Client"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete client "${client.name}"?`)) {
                              onDeleteClient(client.id);
                            }
                          }}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete Client"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 italic">
                    No clients match your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GUARDED REUSABLE CLIENT MODAL */}
      <ClientModal
        isOpen={isModalOpen}
        client={editingClient}
        onClose={() => setIsModalOpen(false)}
        onSaveClient={handleModalSave}
      />
    </div>
  );
};
