with open('/src/components/StatementOfAccount.tsx', 'r') as f:
    text = f.read()

old_1 = """                {filteredJournalRecords.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-3.5 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-center">Type</th>
                        <th className="px-3.5 py-2.5">Document #</th>
                        <th className="px-3.5 py-2.5">Client</th>
                        <th className="px-3.5 py-2.5">Particulars / Summary</th>
                        <th className="px-3.5 py-2.5 text-right">
                          Amount (Ksh)
                        </th>
                        <th className="px-3.5 py-2.5 text-center">Status</th>
                        <th className="px-3.5 py-2.5 text-right">
                          One-Click Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredJournalRecords.map((rec) => {"""

new_1 = """                {sortedJournalRecords.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                      <tr>
                        <SortableHeader column="date" label="Date" currentSort={journalSortConfig} onSort={toggleJournalSort} defaultDirection="desc" />
                        <SortableHeader column="type" label="Type" currentSort={journalSortConfig} onSort={toggleJournalSort} align="center" />
                        <SortableHeader column="documentNumber" label="Document #" currentSort={journalSortConfig} onSort={toggleJournalSort} />
                        <SortableHeader column="clientName" label="Client" currentSort={journalSortConfig} onSort={toggleJournalSort} />
                        <SortableHeader column="particularsSummary" label="Particulars / Summary" currentSort={journalSortConfig} onSort={toggleJournalSort} />
                        <SortableHeader column="amount" label="Amount (Ksh)" currentSort={journalSortConfig} onSort={toggleJournalSort} align="right" defaultDirection="desc" />
                        <SortableHeader column="status" label="Status" currentSort={journalSortConfig} onSort={toggleJournalSort} align="center" />
                        <th className="px-3.5 py-2.5 text-right">
                          One-Click Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sortedJournalRecords.map((rec) => {"""

old_2 = """                {displayLedgerEntries.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Reference #</th>
                        <th className="px-4 py-2.5">
                          Particulars / Description
                        </th>
                        <th className="px-4 py-2.5 text-center">
                          Settlement Status
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          Debit (Invoiced)
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          Credit (Paid)
                        </th>
                        <th className="px-4 py-2.5 text-right">
                          Running Balance
                        </th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {displayLedgerEntries.map((entry) => {"""

new_2 = """                {sortedDisplayLedgerEntries.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                      <tr>
                        <SortableHeader column="date" label="Date" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} defaultDirection="desc" />
                        <SortableHeader column="reference" label="Reference #" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} />
                        <SortableHeader column="description" label="Particulars / Description" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} />
                        <SortableHeader column="status" label="Settlement Status" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} align="center" />
                        <SortableHeader column="debit" label="Debit (Invoiced)" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} align="right" defaultDirection="desc" />
                        <SortableHeader column="credit" label="Credit (Paid)" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} align="right" defaultDirection="desc" />
                        <SortableHeader column="cumulativeBalance" label="Running Balance" currentSort={ledgerSortConfig} onSort={toggleLedgerSort} align="right" defaultDirection="desc" />
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {sortedDisplayLedgerEntries.map((entry) => {"""

assert old_1 in text, "old_1 pattern not found"
assert old_2 in text, "old_2 pattern not found"

text = text.replace(old_1, new_1).replace(old_2, new_2)
with open('/src/components/StatementOfAccount.tsx', 'w') as f:
    f.write(text)
print("SUCCESS")
